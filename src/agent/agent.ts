import { randomUUID } from 'node:crypto';
import type {
  AgentAsk,
  AgentOptions,
  AgentProvider,
  AgentStatus,
  AgentSubscriber,
} from './types';
import type { ApprovalBroker } from '../approval/broker';
import type { ToolBroker } from '../mcp/index';
import type { CommandApprover } from '../approval/gate';
import { humanApprover } from '../approval/human';
import { ApprovalReview } from '../approval/review';
import { WorkspaceLock } from './lock';
import { AgentOutput } from './output';
import { getConfig, isConfigLoaded } from '../config/index';
import {
  Executor,
  ProgramExecutionError,
  type OutputDispatcher,
} from '../execute/index';
import { runProvider } from './run-provider';
import { createConsumer } from '../events/index';
import {
  closeLogger,
  isDebug,
  isLoggerOpen,
  log,
  openLogger,
} from '../logger/index';
import { runAs, currentRun, type AgentContext } from '../context/index';
import type {
  AgentEvent,
  LiveTurn,
  ProviderEvent,
  TokenUsage,
  TrafficEvent,
} from '../providers/types';
import { Store, type StoreNetworkLedger } from '../store/index';
import type { AgentPolicy } from '../policy/index';
import { rejectUnknownOptions, UsageError } from '../errors';
import { APPROVAL_POLL_MS, THINKING_TICK_MS } from './constants';
import type { Interaction } from '../interaction/index';
import { REASONING_MARK } from '../output/constants';
import { listenForInterrupt } from '../execute/interrupt';
import { scriptSignal } from '../usage';
import type { Workspace } from '../workspace/index';
import { currentProcessCommand, environment } from '../execute/process';
import { abortable, anySignal, delay, isAbortError } from './abort';
import { enforcePolicy, ownToolBroker, shareHost } from './enforce';
import {
  AGENT_SOURCE,
  agentEvents,
  logTool,
  publish,
  usageRecord,
} from './events';
import {
  APPROVALS_FINISHED,
  type NextTurn,
  agentConversation,
  isApprovalsCommand,
  isLocalApprovalResult,
  listenInput,
} from './input';
import {
  BACKGROUND_MESSAGE,
  CONTINUE,
  describeNotices,
  FORGOTTEN_SESSION_MESSAGE,
  LIVE_DELIVERED_MESSAGE,
  LIVE_KEPT_MESSAGE,
  THINKING_MESSAGE,
  waitingMessage,
} from './messages';
import { watchThinking } from './thinking';

// The pieces split out of this file, still exported from it.
export {
  AGENT_SHORTCUTS,
  APPROVALS_FINISHED,
  agentConversation,
  listenInput,
} from './input';
export { watchThinking } from './thinking';

/**
 * Every option of the Agent: a key not here is refused. A
 * `Record<keyof AgentOptions, true>`, so the typecheck keeps it equal to the
 * type: an option added there and not here does not compile.
 */
const AGENT_OPTIONS: Readonly<Record<keyof AgentOptions, true>> = {
  name: true,
  prompt: true,
  provider: true,
  workspace: true,
  executor: true,
  output: true,
  interaction: true,
  policy: true,
  signal: true,
  approve: true,
  store: true,
  conversation: true,
  awaitApprovals: true,
  resume: true,
  approvalPollMs: true,
  thinkingTickMs: true,
  subscribe: true,
};

export class Agent {
  /** Identifies the agent in its events, logs and sessions. */
  public readonly name: string;
  public readonly prompt: string;

  public readonly provider: AgentProvider;
  private readonly executor: Executor;
  /** Where every CLI turn's events are also published (`output` option). */
  private readonly dispatcher:
    OutputDispatcher<ProviderEvent<string>> | undefined;
  public readonly workspace: Workspace;
  private readonly output: Interaction;
  private readonly signal: AbortSignal | undefined;
  /** Ctrl+C while it runs, when nobody gave it a signal (no runScript). */
  private interrupted: AbortSignal | undefined;
  private readonly store: Store | undefined;
  private readonly broker: ApprovalBroker | undefined;
  /** The agent's own tools (src/mcp), served to its CLI over MCP. */
  private readonly toolBroker: ToolBroker | undefined;
  /** Where the network gate keeps its decisions, in this run's session. */
  private readonly networkLedger: StoreNetworkLedger | undefined;
  /** One running agent per workspace, across programs. */
  private readonly lock: WorkspaceLock;
  /** A session to continue on the next run, named by `CHOLIBA_RESUME_SESSION`. */
  private forced: string | undefined;
  private readonly conversation: boolean;
  /** Continues an interrupted task on its own (`resume`). */
  private readonly resumes: boolean;
  private readonly policy: AgentPolicy | undefined;
  private readonly subscribers: readonly AgentSubscriber[];
  /** What the agent said while the approvals screen was open; shown after. */
  private held: string[] | undefined;
  /** The run going on, for what is logged outside its context. */
  private activeRun: string | undefined;
  /** The last piece streamed of the message being written, if any. */
  private streamed: string | undefined;
  /** A reasoning streamed now, its line still open. */
  private reasoning = false;
  /** A reasoning was streamed since the CLI last reported one. */
  private reasoningStreamed = false;
  /** Tells the turn's thinking watch the model spoke (while a turn runs). */
  private spoke: (() => void) | undefined;
  /** The status line it should show now (`pensando`, `rodando`…). */
  private wantedStatus: string | undefined;
  /** Approvals being asked right now: the CLI waits on them, it is not silent. */
  private approving = 0;
  private state: AgentStatus = 'idle';
  /** The run in progress; `run()` while running returns it. */
  private current: Promise<void> | undefined;
  /** Stops the run in progress (pause, stop). */
  private controller: AbortController | undefined;
  /** Pausing: the run ends but the sandbox and the gate stay open. */
  private keepOpen = false;
  private readonly approvalPollMs: number;
  private readonly thinkingTickMs: number;
  /** See `AgentOptions.awaitApprovals`. */
  private readonly awaitApprovals: boolean;

  public constructor(options: AgentOptions) {
    rejectUnknownOptions(options, AGENT_OPTIONS, 'no Agent');
    const {
      name,
      prompt,
      provider,
      workspace,
      executor,
      output,
      interaction = agentConversation(),
      policy,
      signal = scriptSignal(),
      approve,
      store,
      conversation = true,
      awaitApprovals = true,
      resume = true,
      approvalPollMs = APPROVAL_POLL_MS,
      thinkingTickMs = THINKING_TICK_MS,
      subscribe = [],
    } = options;
    if (name.trim().length === 0) {
      throw new UsageError('O nome do agente não pode estar vazio.');
    }

    if (prompt.trim().length === 0) {
      throw new UsageError('O prompt do agente não pode estar vazio.');
    }

    this.prompt = prompt;
    this.name = name;
    this.provider = provider;
    this.workspace = workspace;
    this.lock = new WorkspaceLock(workspace.root, name);
    this.executor = executor ?? new Executor();
    this.dispatcher = output;
    this.output = interaction;
    this.signal = signal;
    this.conversation = conversation;
    this.awaitApprovals = awaitApprovals;
    this.resumes = resume;
    this.approvalPollMs = approvalPollMs;
    this.thinkingTickMs = thinkingTickMs;
    this.policy = policy;
    this.subscribers = subscribe;
    // Forces one session (e.g. relaunched by `approvals`); otherwise the store
    // decides whether to continue (see `resumableSession`).
    this.forced = forcedSession();
    this.store = store ?? defaultStore();
    // The requests are changed on their way through the network boundary,
    // and only a policy sets one up.
    if (policy === undefined && provider.rewriteRequest !== undefined) {
      throw new UsageError(
        `O provider ${provider.id} precisa ajustar os pedidos ao modelo (como o think: false do OllamaProvider), e isso só acontece com uma política: dê ao agente policy.`,
      );
    }
    const enforced =
      policy === undefined
        ? undefined
        : enforcePolicy({
            policy,
            provider,
            workspace,
            approve: this.whileApproving(
              approve ?? humanApprover(interaction, signal),
            ),
            store: this.store,
            onTraffic: (event) => this.onTraffic(event),
          });
    this.broker = enforced?.broker;
    this.networkLedger = enforced?.networkLedger;
    shareHost(workspace, provider, policy);
    this.toolBroker = ownToolBroker(provider, workspace, policy);
  }

  /**
   * While a question is open the CLI is waiting for the person, not
   * thinking: no `pensando` over the prompt meanwhile.
   */
  private whileApproving(approve: CommandApprover): CommandApprover {
    return async (request) => {
      this.approving += 1;
      try {
        return await approve(request);
      } finally {
        this.approving -= 1;
        this.renderStatus();
      }
    };
  }

  /** idle, running, paused, stopped or destroyed. */
  public status(): AgentStatus {
    return this.state;
  }

  /**
   * Starts the conversation; while it runs, returns the run in progress. An
   * interrupted task of the same prompt is continued automatically.
   */
  public run(): Promise<void> {
    this.assertUsable();
    return this.current ?? this.start();
  }

  /**
   * Interrupts the current turn and keeps the sandbox and the gate open;
   * `run()` continues it.
   */
  public async pause(): Promise<void> {
    if (this.current === undefined) return;

    this.keepOpen = true;
    this.state = 'paused';
    await this.interrupt();
  }

  /**
   * Ends the run and closes the sandbox and the gate; the session stays open
   * in the database, and the next `run()` continues it.
   */
  public async stop(): Promise<void> {
    if (this.current !== undefined) {
      this.state = 'stopped';
      await this.interrupt();
      return;
    }

    if (this.state === 'paused') {
      await this.closeResources();
      this.state = 'stopped';
    }
  }

  /** Stops and drops the open sessions: the next run starts from scratch. */
  public async reset(): Promise<void> {
    this.assertUsable();
    await this.stop();
    this.store?.abandonOtherSessions(this.provider.id, this.workspace.root, '');
    this.forced = undefined;
    this.state = 'idle';
  }

  /**
   * Stops, ends the open sessions and releases everything: the agent cannot
   * be used again, and the next run of it starts from scratch.
   */
  public async destroy(): Promise<void> {
    if (this.state === 'destroyed') return;

    await this.stop();
    this.store?.abandonOtherSessions(this.provider.id, this.workspace.root, '');
    this.store?.close();
    this.state = 'destroyed';
  }

  private start(): Promise<void> {
    this.controller = new AbortController();
    this.state = 'running';
    // Without a signal (an agent file without runScript), Ctrl+C is its own.
    const interrupt =
      this.signal === undefined ? listenForInterrupt() : undefined;
    this.interrupted = interrupt?.signal;
    // Deferred so `current` is set before the first report: a subscriber
    // calling `run()` gets this run instead of starting another.
    const run = Promise.resolve()
      .then(() => runAs(this.agentContext(), () => this.runConversation()))
      .finally(() => {
        interrupt?.dispose();
        this.current = undefined;
        this.controller = undefined;
        // Interrupted from outside (Ctrl+C): stopped, the session stays open.
        if (this.state === 'running') {
          this.state =
            this.outerSignal()?.aborted === true ? 'stopped' : 'idle';
        }
      });
    this.current = run;
    return run;
  }

  private async interrupt(): Promise<void> {
    const run = this.current;
    this.controller?.abort();
    try {
      await run;
    } catch {
      // The run reports its own failure.
    } finally {
      this.keepOpen = false;
    }
  }

  /** Who reports: this agent and the provider, model and CLI it runs on. */
  /**
   * A request's tokens, read from the model's traffic: emitted and logged as
   * this agent, in the run going on (the connection carries no context of
   * its own).
   */
  private onTraffic(event: TrafficEvent): void {
    if (event.type === 'text') this.showPiece(event.text);
    else if (event.type === 'reasoning') this.showReasoningPiece(event.text);
    else this.recordUsage(event.usage);
  }

  /**
   * A piece of the reasoning, on screen as it comes, after the mark on its
   * own line; the answer's first piece ends that line.
   */
  private showReasoningPiece(text: string): void {
    if (this.held !== undefined) return;
    // An interaction that tells reasoning apart shows it its own way.
    if (this.output.reasoning !== undefined) {
      this.spoke?.();
      this.output.reasoning(text);
      this.reasoningStreamed = true;
      return;
    }
    if (this.output.stream === undefined) return;
    this.spoke?.();
    if (!this.reasoning) {
      if (this.streamed !== undefined && !this.streamed.endsWith('\n')) {
        this.output.stream('\n');
      }
      this.output.stream(`${REASONING_MARK} `);
      this.reasoning = true;
      this.reasoningStreamed = true;
    }
    this.output.stream(text);
    this.streamed = text;
  }

  /** The reasoning's line is over: what comes next starts on a new one. */
  private endReasoning(): void {
    if (!this.reasoning) return;
    this.reasoning = false;
    if (this.streamed !== undefined && !this.streamed.endsWith('\n')) {
      this.output.stream?.('\n');
    }
    this.streamed = undefined;
  }

  /**
   * A piece of the answer, on screen as it is written where the interaction
   * can (from the model's traffic, or from a CLI that prints its pieces).
   * Not logged: the whole message that follows is.
   */
  private showPiece(text: string): void {
    if (this.output.stream === undefined || this.held !== undefined) return;
    this.endReasoning();
    this.spoke?.();
    this.output.stream(text);
    this.streamed = text;
  }

  private recordUsage(usage: TokenUsage): void {
    runAs(
      this.agentContext(),
      () => publish(usageRecord(usage)),
      this.activeRun,
    );
  }

  private agentContext(): AgentContext {
    const provider = this.provider.describe?.();
    return provider === undefined
      ? { name: this.name }
      : { name: this.name, provider };
  }

  /** The whole configuration this agent runs with; secrets are masked by the log. */
  private configuration(): Record<string, unknown> {
    const config = isConfigLoaded() ? getConfig() : undefined;

    return {
      name: this.name,
      prompt: this.prompt,
      provider: this.provider.describe?.() ?? { name: this.provider.id },
      workspace: {
        ...this.workspace.options,
        hostState: this.workspace.hostState,
      },
      policy: this.policy ?? null,
      gate: this.broker !== undefined,
      conversation: this.conversation,
      resume: this.resumes,
      subscribers: this.subscribers.length,
      choliba:
        config === undefined
          ? null
          : {
              configPath: config.configPath ?? null,
              debug: config.debug,
              logger: {
                dir: config.logger.dir,
                use: config.logger.use !== undefined,
              },
              databasePath: config.databasePath,
              env: config.env?.vars ?? {},
            },
    };
  }

  private assertUsable(): void {
    if (this.state === 'destroyed') {
      throw new UsageError(`O agente ${this.name} foi destruído.`);
    }
  }

  /** Who stops it from outside: the given signal, or its own Ctrl+C. */
  private outerSignal(): AbortSignal | undefined {
    return this.signal ?? this.interrupted;
  }

  /** The external signal (Ctrl+C) or this run's own (pause, stop). */
  private runSignal(): AbortSignal | undefined {
    return anySignal(this.outerSignal(), this.controller?.signal);
  }

  private takeForcedSession(): string | undefined {
    const session = this.forced;
    this.forced = undefined;
    return session;
  }

  private async closeResources(): Promise<void> {
    await this.broker?.close();
    await this.toolBroker?.close();
    await this.workspace.close();
    this.lock.release();
  }

  private async runConversation(): Promise<void> {
    try {
      const answer: AgentAsk = (question, signal) =>
        this.output.ask(question, anySignal(this.runSignal(), signal));
      const listen = this.output.listen?.bind(this.output);

      for await (const event of this.interact(this.prompt, answer, listen)) {
        if (event.type === 'output') {
          this.say(event.value);
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        this.show('\n');
        return;
      }

      if (
        error instanceof UsageError ||
        error instanceof ProgramExecutionError
      ) {
        this.show(error.message);
        return;
      }

      throw error;
    }
  }

  /**
   * The conversation, run as this agent: everything reported on the way
   * (commands, sandbox, tools, decisions…) carries `agent: name`.
   */
  private async *interact(
    input: string,
    answer: AgentAsk,
    listen?: (signal?: AbortSignal) => Promise<string>,
  ): AsyncIterable<AgentEvent<string>> {
    const turns = this.converse(input, answer, listen)[Symbol.asyncIterator]();
    // One run for the whole conversation, also when called outside `run()`.
    const run = currentRun(this.name) ?? randomUUID();
    this.activeRun = run;

    for (;;) {
      const next = await runAs(this.agentContext(), () => turns.next(), run);
      if (next.done === true) return;
      yield next.value;
    }
  }

  private async *converse(
    input: string,
    answer: AgentAsk,
    listen?: (signal?: AbortSignal) => Promise<string>,
  ): AsyncIterable<AgentEvent<string>> {
    // runScript owns the log of the whole script; outside it, the agent does.
    const ownsLogger = !isLoggerOpen();
    if (ownsLogger) openLogger();
    // The subscribers hear everything this agent reports, not other agents'.
    const subscribers = createConsumer((event) => {
      if (event.agent !== this.name) return;
      const output = new AgentOutput(event, this);
      for (const subscriber of this.subscribers) subscriber(output);
    });
    subscribers.subscribe(AGENT_SOURCE);
    // With debug, everything this run uses, so the log says how it ran.
    if (isDebug()) {
      log.debug({ type: 'agent_config', config: this.configuration() });
    }
    publish({ type: 'input', value: input });

    let nextInput = input;
    let sessionId: string | undefined;
    /** CLI turns of this run, 1-based; each one is told to the subscribers. */
    let turns = 0;
    /** The model this run is on: a session is resumed only on the same one. */
    const model = this.provider.describe?.().model;
    /** The stored session this run tries to continue, until the CLI confirms it. */
    let resuming: string | undefined;
    /**
     * A session this run opened whose first turn has not ended yet: if the CLI
     * fails now, its history may not hold the task, and it must not be resumed.
     */
    let unanswered: string | undefined;

    try {
      // Before the sandbox and the gate: another run here would only wait.
      this.lock.acquire();
      await this.broker?.start();
      await this.toolBroker?.start();
      sessionId = this.resumedSession(input);

      if (sessionId !== undefined) {
        this.broker?.setSession(sessionId);
        this.networkLedger?.setSession(sessionId);
        // The task is already in the session's history: only what changed.
        nextInput = this.continuation(sessionId);
        publish({ type: 'resume', session: sessionId, input: nextInput });
        resuming = sessionId;
      }

      while (true) {
        let pendingAnswer: Promise<string> | undefined;
        /** The last reasoning shown this turn. */
        let reasoned: string | undefined;
        const question = new AbortController();
        /** The CLI taking messages while it runs, where the provider can. */
        let live: LiveTurn | undefined;
        const typed = listenInput(
          listen,
          anySignal(this.runSignal(), question.signal),
          async (value) => {
            const message = await this.dispatchLiveInput(value, sessionId);
            // Straight to the running CLI; once it takes no more, kept for
            // the next turn as before.
            const delivered =
              message !== undefined &&
              message !== APPROVALS_FINISHED &&
              live?.send(message) === true;
            if (delivered) {
              publish({ type: 'live_input', value: message });
              this.say(LIVE_DELIVERED_MESSAGE);
            }
            // Whatever was written over it (the echo, a notice), the turn
            // goes on: its status line comes back.
            this.renderStatus();
            return delivered ? undefined : message;
          },
          () => this.say(LIVE_KEPT_MESSAGE),
        );

        // The loop runs while the CLI does (it ends when the process exits).
        // While the model works: one line on screen when it starts, and
        // every phase (start, ticks, end) for the subscribers.
        const thinking = watchThinking(
          (phase, seconds) => {
            if (phase === 'start') this.setStatus(THINKING_MESSAGE);
            if (phase === 'end') this.setStatus(undefined);
            const record = { type: 'thinking', phase, seconds };
            // A tick is a clock, not something that happened: not logged.
            if (phase === 'tick') agentEvents.emit(record);
            else publish(record, 'debug');
          },
          { every: this.thinkingTickMs, paused: () => this.approving > 0 },
        );
        this.spoke = () => thinking.spoke();

        turns += 1;
        // A clock for whoever measures the run, not something that happened:
        // not logged.
        agentEvents.emit({ type: 'turn', phase: 'start', turn: turns });
        try {
          for await (const event of runProvider(this.provider, {
            executor: this.executor,
            workspace: this.workspace,
            input: nextInput,
            sessionId,
            signal: this.runSignal(),
            dispatcher: this.dispatcher,
            onLive: (turn) => {
              live = turn;
            },
          })) {
            if (event.type === 'session') {
              resuming = undefined;
              // A brand-new session replaces the open ones it cannot resume.
              if (sessionId === undefined) {
                this.store?.abandonOtherSessions(
                  this.provider.id,
                  this.workspace.root,
                  event.id,
                );
                unanswered = event.id;
              }
              sessionId = event.id;
              this.broker?.setSession(event.id);
              this.networkLedger?.setSession(event.id);
              this.store?.recordSession({
                id: event.id,
                provider: this.provider.id,
                root: this.workspace.root,
                prompt: input,
                agent: this.name,
                ...(model === undefined ? {} : { model }),
                command: currentProcessCommand(),
              });
              publish({ type: 'session', id: event.id });
              continue;
            }

            if (event.type === 'tool') {
              // Reaches the log and the subscribers, not the conversation.
              logTool(event);
              agentEvents.emit({
                type: 'tool',
                phase: event.phase,
                detail: event.detail,
              });
              // On screen: a tool running, then back to the model.
              this.setStatus(
                event.phase === 'call' ? BACKGROUND_MESSAGE : THINKING_MESSAGE,
              );
              continue;
            }

            if (event.type === 'stderr') {
              // The CLI's own words: on screen and in the log, never passed
              // on as the model's answer.
              publish({ type: 'stderr', value: event.text });
              this.say(event.text.trimEnd());
              continue;
            }

            if (event.type === 'partial') {
              this.showPiece(event.text);
              continue;
            }

            if (event.type === 'usage') {
              publish(usageRecord(event.usage, event.action));
              continue;
            }

            if (event.type === 'cost') {
              publish({ type: 'cost', cost_usd: event.usd });
              continue;
            }

            if (event.type === 'reasoning') {
              // What the model thought, on screen as soon as it arrives:
              // already there when it came piece by piece.
              thinking.spoke();
              publish({ type: 'reasoning', text: event.text }, 'debug');
              if (this.reasoningStreamed) this.endReasoning();
              else if (
                this.output.reasoning !== undefined &&
                this.held === undefined
              ) {
                this.output.reasoning(event.text);
              } else this.say(`${REASONING_MARK} ${event.text}`);
              this.reasoningStreamed = false;
              reasoned = event.text;
              continue;
            }
            publish({ ...event });
            thinking.spoke();

            const text = event.type === 'ask' ? event.question : event.value;
            this.endReasoning();
            const streamed = this.streamed;
            if (streamed !== undefined || text === reasoned) {
              // Already on screen (streamed, or the reasoning the CLI gave
              // as its answer): end its line and tell the subscribers.
              if (streamed !== undefined && !streamed.endsWith('\n')) {
                this.output.stream?.('\n');
              }
              this.streamed = undefined;
              publish({ type: 'message', text }, 'debug');
              if (event.type === 'ask') yield event;
            } else {
              if (event.type === 'ask') {
                yield { type: 'output', value: event.question };
              }

              yield event;
            }

            if (event.type === 'ask' && pendingAnswer === undefined) {
              pendingAnswer =
                typed?.promise ?? answer(event.question, question.signal);
              // Keep the rejection handled until this turn finishes and awaits it.
              void pendingAnswer.catch(() => undefined);
            }
          }
        } catch (error) {
          // The CLI no longer has the stored session (its history is gone):
          // start the task over in a new one instead of failing.
          if (
            resuming === undefined ||
            !(error instanceof ProgramExecutionError)
          ) {
            throw error;
          }
          typed?.cancel();
          question.abort();
          this.show(FORGOTTEN_SESSION_MESSAGE);
          publish({ type: 'resume_failed', session: resuming }, 'error');
          this.store?.abandonOtherSessions(
            this.provider.id,
            this.workspace.root,
            '',
          );
          resuming = undefined;
          sessionId = undefined;
          nextInput = input;
          continue;
        } finally {
          this.spoke = undefined;
          thinking.stop();
          agentEvents.emit({ type: 'turn', phase: 'end', turn: turns });
        }

        // The turn ended: the session holds the task now.
        unanswered = undefined;

        const waiting =
          sessionId === undefined || !this.awaitApprovals
            ? 0
            : this.pendingDenials(sessionId);

        pendingAnswer ??= typed?.submitted();

        // A conversation never ends on its own: wait for the next message.
        if (pendingAnswer === undefined && this.conversation) {
          pendingAnswer = typed?.promise ?? answer('', question.signal);
        }

        if (pendingAnswer === undefined && waiting > 0) {
          pendingAnswer = typed?.promise;
        }

        if (pendingAnswer === undefined && waiting === 0) {
          typed?.cancel();
          // Ended on its own (not interrupted): the next run starts over.
          if (sessionId !== undefined) this.store?.finishSession(sessionId);
          return;
        }

        if (sessionId === undefined) {
          throw new Error('O provider não informou o identificador da sessão.');
        }

        if (waiting > 0)
          yield { type: 'output', value: waitingMessage(waiting) };

        const next = await this.nextTurn(sessionId, pendingAnswer, waiting > 0);
        question.abort();
        const resolved = await this.resolveLocalInput(sessionId, next, listen);
        nextInput = resolved.input;
        const turn = {
          type: resolved.approved ? 'approved' : 'answer',
          value: nextInput,
        } as const;
        publish(turn);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        if (unanswered !== undefined) this.store?.failSession(unanswered);
        log.failure(error);
        agentEvents.emit({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    } finally {
      if (ownsLogger) closeLogger();
      // Paused: the sandbox and the gate stay open for the next run().
      if (!this.keepOpen) await this.closeResources();
      // Releases the terminal; it is taken again on the next run.
      this.output.close?.();
      subscribers.unsubscribeAll();
    }
  }

  /**
   * Continues the same task when it was interrupted or something was approved
   * for it since; a different prompt is a new task.
   */
  private resumedSession(prompt: string): string | undefined {
    const forced = this.takeForcedSession();
    if (forced !== undefined || !this.resumes) return forced;
    return this.store?.resumableSession(
      this.provider.id,
      this.workspace.root,
      prompt,
      this.provider.describe?.().model,
    );
  }

  /** Commands denied in this session that nobody has approved yet. */
  private pendingDenials(session: string): number {
    return (
      this.store
        ?.deniedDecisions(this.workspace.root)
        .filter((decision) => decision.session === session).length ?? 0
    );
  }

  /** Executes terminal-local commands instead of forwarding them to the model. */
  private async resolveLocalInput(
    session: string,
    next: NextTurn,
    listen: ((signal?: AbortSignal) => Promise<string>) | undefined,
  ): Promise<NextTurn> {
    if (listen === undefined) return next;

    let current = next;

    while (isLocalApprovalResult(current.input)) {
      if (isApprovalsCommand(current.input)) {
        await this.reviewApprovals();
      }
      const notices =
        this.store?.pendingNotices(this.workspace.root, session) ?? [];
      if (notices.length > 0) {
        return { input: this.continuation(session), approved: true };
      }

      this.show('Nenhuma aprovação foi adicionada.');
      const typed = listenInput(listen, this.runSignal(), (value) =>
        this.dispatchLiveInput(value, session),
      );
      current = await this.nextTurn(
        session,
        typed?.promise,
        this.pendingDenials(session) > 0,
      );
    }

    return current;
  }

  /** The approvals screen, on the agent's own input and output. */
  private async reviewApprovals(): Promise<void> {
    if (this.store === undefined) return;

    // The screen owns the terminal: the agent's output waits until it closes.
    this.held = [];
    try {
      await new ApprovalReview(this.store, this.output).run(
        this.workspace.root,
      );
    } finally {
      const held = this.held;
      this.held = undefined;
      for (const value of held) this.show(value);
      this.renderStatus();
    }
  }

  /**
   * The status line, rewritten in place where the interaction can (the
   * terminal). An interaction without it gets `pensando` as a line, once
   * each time the model starts.
   */
  private setStatus(text: string | undefined): void {
    const fallback =
      this.output.status === undefined &&
      text === THINKING_MESSAGE &&
      this.wantedStatus === undefined;
    const changed = text !== this.wantedStatus;
    this.wantedStatus = text;
    // The agent emits it; each interaction draws it its own way.
    if (changed) publish({ type: 'status', text: text ?? null }, 'debug');
    if (fallback && this.held === undefined) this.show(text);
    this.renderStatus();
  }

  /** Not over the approvals screen or a question being answered. */
  private renderStatus(): void {
    if (this.held !== undefined || this.approving > 0) return;
    this.output.status?.(this.wantedStatus);
  }

  private say(value: string): void {
    if (this.held === undefined) this.show(value);
    else this.held.push(value);
  }

  /** Shows text through the interaction and tells the subscribers. */
  private show(text: string): void {
    this.output.write(text);
    publish({ type: 'message', text }, 'debug');
  }

  /**
   * Runs approvals immediately when its local command is submitted. Without
   * a new approval, `undefined`: the terminal keeps listening (Ctrl+A again).
   */
  private async dispatchLiveInput(
    input: string,
    session: string | undefined,
  ): Promise<string | undefined> {
    if (!isApprovalsCommand(input)) return input;

    if ((this.store?.deniedDecisions(this.workspace.root).length ?? 0) === 0) {
      this.show(
        'Nenhum comando negado para aprovar. De volta ao agente: digite sua mensagem.',
      );
      return undefined;
    }

    await this.reviewApprovals();
    const notices =
      session === undefined
        ? []
        : (this.store?.pendingNotices(this.workspace.root, session) ?? []);
    if (notices.length > 0) return APPROVALS_FINISHED;

    this.show(
      'Nenhuma aprovação foi adicionada. De volta ao agente: digite sua mensagem.',
    );
    return undefined;
  }

  /**
   * The next input: the person's answer, or, if denials are pending, the
   * approvals given meanwhile in `bun run approvals`, whichever comes first.
   */
  private async nextTurn(
    session: string,
    answer: Promise<string> | undefined,
    awaitApproval: boolean,
  ): Promise<NextTurn> {
    const polling = new AbortController();
    const candidates: Promise<{ input: string; approved: boolean }>[] = [];

    if (answer !== undefined) {
      candidates.push(answer.then((input) => ({ input, approved: false })));
    }

    if (awaitApproval) {
      candidates.push(
        this.approvalArrived(session, polling.signal).then(() => ({
          input: this.continuation(session),
          approved: true,
        })),
      );
    }

    try {
      return await abortable(Promise.race(candidates), this.runSignal());
    } finally {
      polling.abort();
    }
  }

  /** Resolves when an approval for this session shows up in the store. */
  private async approvalArrived(
    session: string,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      const notices =
        this.store?.pendingNotices(this.workspace.root, session) ?? [];
      if (notices.length > 0) return;
      await delay(this.approvalPollMs, signal);
    }

    // Lost the race (an answer came first): never resolve.
    return new Promise(() => undefined);
  }

  /** What the resumed agent is told: approvals since it stopped, then go on. */
  private continuation(session: string): string {
    const notices =
      this.store?.pendingNotices(this.workspace.root, session) ?? [];
    this.store?.markNotified(notices.map((notice) => notice.id));

    return [
      ...describeNotices(
        notices.map((approval) => ({
          approval,
          asked:
            approval.decisionId === undefined
              ? undefined
              : this.store?.decision(approval.decisionId)?.command,
        })),
      ),
      CONTINUE,
    ].join('\n');
  }
}

/** `CHOLIBA_RESUME_SESSION`, if set and not empty. */
function forcedSession(): string | undefined {
  const session = environment()['CHOLIBA_RESUME_SESSION']?.trim();
  return session === undefined || session.length === 0 ? undefined : session;
}

function defaultStore(): Store | undefined {
  return isConfigLoaded() ? Store.open(getConfig().databasePath) : undefined;
}
