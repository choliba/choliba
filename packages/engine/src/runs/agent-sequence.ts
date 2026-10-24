import { handBackOf, type HandBack } from './hand-back';

export interface SequenceAgent {
  readonly id: string;
  readonly defaultTask?: string | undefined;
}

export type SequenceStopReason = 'declined' | 'failed' | 'handed-back' | 'interrupted' | 'missing' | 'not-started';

export interface SequenceResult {
  readonly agent: string;
  readonly task: string;
  readonly reason: 'completed' | SequenceStopReason;
  readonly exitCode?: number | undefined;
  readonly ticket?: string | undefined;
  /** What the agent said last (its answer, or why it stopped), when it said anything. */
  readonly conclusion?: string | undefined;
}

/** How one run of a sequence ended: its exit code and what the agent concluded. */
export interface SequenceRun {
  readonly code: number;
  readonly conclusion?: string | undefined;
}

export interface SequencePrompt {
  readonly question: string;
  readonly options: readonly string[];
  readonly multi: boolean;
}

export type SequenceQuestion =
  { readonly kind: 'agent'; readonly question: SequencePrompt } | { readonly kind: 'continue'; readonly agent: string };

export interface AgentSequenceState {
  readonly running: boolean;
  readonly current?: string | undefined;
  readonly resumeAt?: number | undefined;
  readonly pending?: SequenceQuestion | undefined;
  readonly results: readonly SequenceResult[];
  /** Every run of the session, oldest first, across `/resume`s, until `forget`. */
  readonly history: readonly SequenceResult[];
}

export interface SequenceStop {
  readonly at: number;
  readonly agent: string;
  readonly reason: SequenceStopReason;
  /** The agent `agent` handed the work back to (`handed-back`), and why; `/resume` points at it. */
  readonly handBack?: HandBack | undefined;
}

export interface SequenceExecution<Agent extends SequenceAgent> {
  /** Runs `agent` with `task`, telling it what the session's other runs concluded; nothing when it did not start. */
  readonly run: (agent: Agent, task: string, others: readonly SequenceResult[]) => Promise<SequenceRun | undefined>;
  readonly continueTo: (agent: string) => Promise<boolean>;
  readonly ticket: () => string | undefined;
  readonly before: (agents: readonly string[]) => void;
  readonly missing: (agent: string) => void;
  readonly stopped: (stop: SequenceStop) => void;
  readonly hold: (multiple: boolean) => () => void;
}

export interface AgentSequence<Agent extends SequenceAgent> {
  readonly start: (from: number, task: string | undefined, execution: SequenceExecution<Agent>) => Promise<void>;
  readonly state: () => AgentSequenceState;
  readonly interrupt: () => void;
  readonly question: (question: SequencePrompt | undefined) => void;
  readonly resetStop: () => void;
  /** Forgets the session's runs: a new session (`/clear`) tells its agents nothing of the old one. */
  readonly forget: () => void;
}

export function createAgentSequence<Agent extends SequenceAgent>(
  agentIds: () => readonly string[],
  loadAgent: (id: string) => Agent | undefined,
  changed: (state: AgentSequenceState) => void = noopChanged,
): AgentSequence<Agent> {
  let running = false;
  let current: string | undefined;
  let resumeAt: number | undefined;
  let pending: SequenceQuestion | undefined;
  let interrupted = false;
  let firstTask = '';
  let results: readonly SequenceResult[] = [];
  let history: readonly SequenceResult[] = [];

  const state = (): AgentSequenceState => ({ running, current, resumeAt, pending, results, history });
  const notify = (): void => {
    changed(state());
  };
  const setPending = (question: SequenceQuestion | undefined): void => {
    pending = question;
    notify();
  };
  const stopAt = (
    execution: SequenceExecution<Agent>,
    at: number,
    reason: SequenceStopReason,
    handBack?: HandBack,
  ): void => {
    const ids = agentIds();
    const agent = ids[at];
    const back = handBack === undefined ? -1 : ids.indexOf(handBack.agent);
    resumeAt = ids.length < 2 || agent === undefined ? undefined : back >= 0 ? back : at;
    if (agent !== undefined) execution.stopped({ at, agent, reason, ...(handBack === undefined ? {} : { handBack }) });
    notify();
  };

  const runFrom = async (
    from: number,
    task: string | undefined,
    execution: SequenceExecution<Agent>,
  ): Promise<void> => {
    if (running) return;
    const initial = agentIds();
    running = true;
    interrupted = false;
    resumeAt = undefined;
    results = [];
    if (task !== undefined && from === 0) firstTask = task;
    execution.before(initial.slice(from));
    const release = execution.hold(initial.length > 1);
    notify();
    try {
      await runAgents(from, task, execution);
    } finally {
      running = false;
      current = undefined;
      pending = undefined;
      release();
      notify();
    }
  };

  const runAgents = async (
    from: number,
    task: string | undefined,
    execution: SequenceExecution<Agent>,
  ): Promise<void> => {
    for (let at = from, id = agentIds()[at]; id !== undefined; at += 1, id = agentIds()[at]) {
      const agent = loadAgent(id);
      if (agent === undefined) {
        execution.missing(id);
        record({ agent: id, task: '', reason: 'missing' }, execution.ticket());
        stopAt(execution, at, 'missing');
        return;
      }
      current = id;
      notify();
      const ownTask = at === from ? task : undefined;
      const effectiveTask = ownTask ?? agent.defaultTask ?? firstTask;
      const ran = await execution.run(agent, effectiveTask, history);
      current = undefined;
      const handBack = interrupted ? undefined : handBackOf(ran?.conclusion, id, agentIds());
      const reason = handBack === undefined ? resultReason(ran?.code, interrupted) : 'handed-back';
      record(
        {
          agent: id,
          task: effectiveTask,
          reason,
          ...(ran === undefined ? {} : { exitCode: ran.code }),
          ...(ran?.conclusion === undefined ? {} : { conclusion: ran.conclusion }),
        },
        execution.ticket(),
      );
      notify();
      if (reason !== 'completed') {
        stopAt(execution, at, reason, handBack);
        return;
      }
      const next = agentIds()[at + 1];
      if (next !== undefined && !(await confirmNext(next, execution))) {
        stopAt(execution, at + 1, 'declined');
        return;
      }
    }
  };

  const record = (result: SequenceResult, ticket: string | undefined): void => {
    const recorded = ticket === undefined ? result : { ...result, ticket };
    results = [...results, recorded];
    history = [...history, recorded];
  };

  const confirmNext = async (next: string, execution: SequenceExecution<Agent>): Promise<boolean> => {
    setPending({ kind: 'continue', agent: next });
    try {
      return await execution.continueTo(next);
    } finally {
      setPending(undefined);
    }
  };

  return {
    start: runFrom,
    state,
    interrupt: () => {
      interrupted = true;
      notify();
    },
    question: (question) => {
      setPending(question === undefined ? undefined : { kind: 'agent', question });
    },
    resetStop: () => {
      resumeAt = undefined;
      notify();
    },
    forget: () => {
      results = [];
      history = [];
      notify();
    },
  };
}

function resultReason(code: number | undefined, interrupted: boolean): SequenceResult['reason'] {
  if (interrupted) return 'interrupted';
  if (code === undefined) return 'not-started';
  return code === 0 ? 'completed' : 'failed';
}

function noopChanged(): void {
  // The state is available through `state` when nobody observes every transition.
}
