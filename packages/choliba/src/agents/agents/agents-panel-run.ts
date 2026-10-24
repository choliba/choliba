import { cardElapsed, formatElapsed, type ChatPanel, type Panel, type PanelContext } from '@choliba/shell';
import { type Container } from '@choliba/kernel';
import { holdApp } from '@choliba/runner';
import {
  createAgentSequence,
  type AgentSequence,
  type AgentSequenceState,
  type SequenceExecution,
  type SequenceStop,
} from '@choliba/engine';

import type { AgentDefinition } from '@choliba/domain';
import { agentVoice } from './agents-panel-card';
import {
  agentKey,
  bold,
  flag,
  gray,
  PROJECT,
  sessionAgent,
  sessionAgentIds,
  sessionArgv,
  showRun,
  STATE,
  TICKET,
  warn,
} from './agents-panel-state';
import { AGENTS } from './agents.constants';
import type { HostedRun } from './agents.service';

/** The status line's part while an agent runs. */
const RUN = 'execução';

/**
 * The ticket flags of a run of `agent`: the ticket chosen with /tickets; with none, and an agent that needs one, a new
 * ticket of the type asked in the field (`--type`, as on the command line); nothing when the question is left with Esc.
 */
async function ticketFlags(
  context: PanelContext,
  agent: AgentDefinition,
  panel: ChatPanel,
): Promise<readonly string[] | undefined> {
  const types = agent.ticketTypes;
  const ticket = context.get(TICKET);
  if (types === undefined || ticket !== undefined || agent.allowWithoutTicket) {
    return flag('--ticket', ticket, types !== undefined);
  }
  const chosen = await panel.choose({
    title: `Ticket novo para ${agent.id}`,
    description: 'Nenhum ticket escolhido: a execução cria um deste tipo. Esc cancela; /tickets escolhe um existente.',
    options: types.map((type) => ({ label: type, detail: '', current: false })),
  });
  const type = chosen === undefined ? undefined : types[chosen];
  return type === undefined ? undefined : ['--type', type];
}

/**
 * The command line after `choliba run agent` for `task`, with the session's choices (`sessionArgv`). What the agent
 * needs and the session lacks is said instead; nothing when the ticket's question is cancelled.
 */
async function runArgv(
  context: PanelContext,
  agent: AgentDefinition,
  task: string,
  panel: ChatPanel,
): Promise<readonly string[] | string | undefined> {
  if (agent.projectRequired && context.get(PROJECT) === undefined) return 'Escolha um projeto antes, com /projects.';
  const ticket = await ticketFlags(context, agent, panel);
  if (ticket === undefined) return undefined;
  return sessionArgv(context, agent, ticket, task);
}

/** How long a run took, as the panel says it: `2m14s`, `9s`. */
function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${String(seconds)}s` : `${String(Math.floor(seconds / 60))}m${String(seconds % 60)}s`;
}

/** The context key of where a stopped sequence resumes: the place, among the session's agents, of the next to run. */
export const RESUME_AT = 'retomar';

/** The conversation of a session with its agents: what /resume calls to run the sequence again from one of them. */
interface Talk {
  readonly resume: (panel: ChatPanel, from: number, task: string | undefined) => void;
  readonly sequence: AgentSequence<AgentDefinition>;
  /** Stops the agent that runs and starts it again, with the session as it is now (`/sandbox`). */
  readonly restart: (panel: ChatPanel) => Promise<void>;
}

/** The sessions whose conversation goes to their agents already: one per session, whichever agents it has. */
const talks = new WeakMap<PanelContext, Talk>();

/** Asks whether to go on to `next` after an agent ended with code 0: Enter goes on, Esc stops the sequence. */
async function goOn(next: string, panel: ChatPanel): Promise<boolean> {
  const chosen = await panel.choose({
    title: `Seguir para ${next}?`,
    description: 'Enter segue; Esc para a sequência, que /resume retoma.',
    options: [{ label: 'seguir', detail: next, current: true }],
  });
  return chosen === 0;
}

/**
 * Makes what is sent with no `/` the task of the session's agents: they run in order, as `choliba run agent` would, in
 * the session's panel, each with its own provider and model; the first takes what was sent, the others their own
 * default task, or what was sent when they have none, and the ticket a run leaves is the next one's. Between two agents the panel asks to go on. A run that
 * fails, an Esc or Ctrl+C stops the sequence where it was, and /resume resumes it from there. While an agent runs, what
 * is sent goes to it, its questions are asked in the field, its card turns a spinner and the status line says how long
 * it has gone; the project's application stays up from the first agent to the last.
 */
export function talkToAgent(container: Container, context: PanelContext): void {
  if (talks.has(context)) return;
  let sending: ((text: string) => void) | undefined;
  let halt: (() => void) | undefined;
  let currentStart: Promise<void> | undefined;
  let restarting = false;
  let inFlightRestart: Promise<void> | undefined;
  const changed = (state: AgentSequenceState): void => {
    context.set(RESUME_AT, state.resumeAt === undefined ? undefined : String(state.resumeAt));
  };
  const sequence: AgentSequence<AgentDefinition> = createAgentSequence(
    () => sessionAgentIds(context),
    (id) => sessionAgent(container, id),
    changed,
  );

  /**
   * One run of `agent` with `task`, told what the session's other runs concluded and telling what it concludes: its exit
   * code, or nothing when it did not start (a question left with Esc).
   */
  const runOne = async (
    agent: AgentDefinition,
    task: string,
    panel: ChatPanel,
    session: Pick<HostedRun, 'conclusions' | 'concluded'>,
  ): Promise<number | undefined> => {
    const argv = await runArgv(context, agent, task, panel);
    if (argv === undefined) return undefined;
    if (typeof argv === 'string') {
      panel.answer(warn(argv));
      return undefined;
    }
    let stopRun: (() => void) | undefined;
    let inSession = false;
    const steps = new AbortController();
    // The agent's session ends before the steps after it: the run stays busy until the very end.
    const closeSession = (): void => {
      inSession = false;
      sending = undefined;
      context.status(RUN, undefined);
    };
    const done = (): void => {
      closeSession();
      context.busy(undefined);
      context.spin(agent.id, false);
    };
    // How the run went, on the agent's card: `concluído` or `falhou`, and how long it took.
    const ended = (code: number): void => {
      const took = cardElapsed(Date.now() - startedAt);
      context.set(agentKey(STATE, agent.id), code === 0 ? `concluído · ${took}` : warn(`falhou · ${took}`));
      showRun(container, context);
    };
    // Ctrl+C and /sandbox stop the agent's session while it is open, else the command of the step running; and the sequence.
    halt = () => {
      sequence.interrupt();
      if (inSession) stopRun?.();
      else steps.abort();
    };
    context.busy(halt);
    const voice = agentVoice(container, agent);
    const hosted = (): Promise<Panel> =>
      Promise.resolve({
        // The agent's lines, in its block: a border in its color on their left, its name first.
        write: (line) => {
          panel.write(line, voice);
        },
        // How long the run has gone, always last in the status line, after the mode and the sandbox.
        refresh: () => {
          context.status(RUN, undefined);
          context.status(RUN, formatElapsed(Date.now() - startedAt));
        },
        onInterrupt: (listener) => {
          inSession = true;
          stopRun = listener;
        },
        ask: async (question, signal) => {
          sequence.question(question);
          try {
            return await panel.ask(question, signal);
          } finally {
            sequence.question(undefined);
          }
        },
        onMessage: (listener) => {
          sending = listener;
        },
        close: closeSession,
      });
    const startedAt = Date.now();
    // The agent's card turns a spinner while it runs; the chat keeps only what the run says.
    context.spin(agent.id, true);
    const announce = (code: number, line: string): number => {
      done();
      if (restarting) return code;
      ended(code);
      panel.answer(line);
      return code;
    };
    try {
      const code = await container.get(AGENTS).runHosted(argv, {
        panel: hosted,
        stdout: replies(panel, (line) => line),
        stderr: replies(panel, warn),
        signal: steps.signal,
        // The ticket the run leaves is the session's: the next agent works on it.
        ticket: (ticket) => {
          context.set(TICKET, ticket);
        },
        ...session,
      });
      const how = code === 0 ? bold('código 0') : warn(`código ${String(code)}`);
      return announce(code, `${agent.id} terminou: ${how} ${gray(`· ${duration(Date.now() - startedAt)}`)}`);
    } catch (error) {
      // An error nothing expected ends this run in the conversation; the panel stays usable for the next one.
      const detail = error instanceof Error ? error.message : String(error);
      return announce(1, warn(`${agent.id} parou por um erro: ${detail}`));
    }
  };

  /** Where the sequence stopped: kept for /resume and said, when the session has more than one agent. */
  const stopped = (stop: SequenceStop, panel: ChatPanel): void => {
    if (sessionAgentIds(context).length < 2) return;
    const ticket = context.get(TICKET);
    const kept = ticket === undefined ? '' : `, com o ticket ${ticket}`;
    panel.answer(warn(`A sequência parou em ${stop.agent}. /resume retoma dele${kept}.`));
  };

  const execution = (panel: ChatPanel): SequenceExecution<AgentDefinition> => ({
    run: async (agent, task, others) => {
      let conclusion: string | undefined;
      const code = await runOne(agent, task, panel, {
        conclusions: others,
        concluded: (said) => {
          conclusion = said;
        },
      });
      if (code === undefined) return undefined;
      return conclusion === undefined ? { code } : { code, conclusion };
    },
    continueTo: (next) => goOn(next, panel),
    ticket: () => context.get(TICKET),
    before: (ids) => {
      for (const id of ids) context.set(agentKey(STATE, id), undefined);
      showRun(container, context);
    },
    missing: (id) => {
      panel.answer(warn(`O agente ${id} não carrega mais: veja com choliba check.`));
    },
    stopped: (stop) => {
      if (!restarting) stopped(stop, panel);
    },
    hold: (multiple) => {
      if (!multiple) return noop;
      const project = context.get(PROJECT);
      return project === undefined ? noop : holdApp(project);
    },
  });

  const runFrom = (from: number, task: string | undefined, panel: ChatPanel): void => {
    currentStart = sequence.start(from, task, execution(panel));
    void currentStart;
  };

  const restart = async (panel: ChatPanel): Promise<void> => {
    if (inFlightRestart !== undefined) {
      await inFlightRestart;
      return;
    }
    const current = sequence.state().current;
    const from = current === undefined ? -1 : sessionAgentIds(context).indexOf(current);
    if (from < 0 || halt === undefined) return;
    inFlightRestart = (async () => {
      restarting = true;
      halt();
      await currentStart;
      restarting = false;
      runFrom(from, undefined, panel);
    })();
    try {
      await inFlightRestart;
    } finally {
      inFlightRestart = undefined;
    }
  };

  talks.set(context, {
    sequence,
    resume: (panel, from, task) => {
      runFrom(from, task, panel);
    },
    restart,
  });
  context.converse((text, panel) => {
    if (sequence.state().running) {
      sending?.(text);
      return;
    }
    void confirmTask(panel, text).then((confirmed) => {
      if (confirmed) runFrom(0, text, panel);
    });
  });
}

/** The fewest characters a task has before the panel takes it as one without asking: an "i" or a "/" is a slip. */
const SHORT_TASK = 3;

/**
 * Whether `task` goes to the agents: at once when it has the length of one, else when the person confirms it was meant.
 */
export async function confirmTask(panel: ChatPanel, task: string): Promise<boolean> {
  if (task.trim().length >= SHORT_TASK) return true;
  const chosen = await panel.choose({
    title: `Mandar "${task.trim()}" como tarefa?`,
    description: 'É curta demais para uma tarefa: confira se não foi enviada por engano.',
    options: [{ label: 'Sim, mandar' }, { label: 'Não' }],
  });
  return chosen === 0;
}

/** The sequence's engine state, which the panel reads to draw and dispatch its controls. */
export function agentSequenceState(context: PanelContext): AgentSequenceState | undefined {
  return talks.get(context)?.sequence.state();
}

/** Forgets where a stopped sequence would resume after its order changes. */
export function resetSequenceStop(context: PanelContext): void {
  talks.get(context)?.sequence.resetStop();
}

/**
 * `/resume`: runs the session's sequence again from its agent at `from`, with `task` for it (its own task without
 * one), with the session's ticket; nothing while it runs.
 */
export function resumeSequence(context: PanelContext, panel: ChatPanel, from: number, task?: string): void {
  talks.get(context)?.resume(panel, from, task);
}

/**
 * Stops the agent that runs and starts it again from there, with the session as it is now: `/sandbox` after a change,
 * so the provider comes up in the sandbox just chosen. Nothing when none runs.
 */
export async function restartSequence(context: PanelContext, panel: ChatPanel): Promise<void> {
  await talks.get(context)?.restart(panel);
}

/** Forgets what the session's agents concluded: a session started over (`/clear`) tells its agents nothing of the old one. */
export function forgetSequence(context: PanelContext): void {
  talks.get(context)?.sequence.forget();
}

function noop(): void {
  // Nothing held: a single agent, or no project.
}

/** Where a run's own lines go (what it says before and after its session): answers in the chat, `paint`ed. */
function replies(
  panel: ChatPanel,
  paint: (line: string) => string,
): { write(chunk: string): void; readonly isTTY: true; readonly columns: number } {
  return {
    write: (chunk) => {
      const text = chunk.trimEnd();
      if (text !== '') panel.answer(paint(text));
    },
    isTTY: true,
    columns: 100,
  };
}
