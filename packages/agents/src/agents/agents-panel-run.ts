import {
  cardElapsed,
  formatElapsed,
  type ChatPanel,
  type Container,
  type Panel,
  type PanelContext,
} from '@choliba/core';
import { holdApp } from '@choliba/projects';

import type { AgentDefinition } from '../common';
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
  readonly running: () => boolean;
  /** The agent running now, if any. */
  readonly current: () => string | undefined;
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
  let running = false;
  // The agent of the sequence running now; the message that started it, the task of the agents with no default one.
  let current: string | undefined;
  let message = '';
  // Set by Ctrl+C: the sequence stops after the run it stopped. Read through a call, as Ctrl+C sets it meanwhile.
  const interrupt = { asked: false };
  const interrupted = (): boolean => interrupt.asked;

  /** One run of `agent` with `task`: its exit code, or nothing when it did not start (a question left with Esc). */
  const runOne = async (agent: AgentDefinition, task: string, panel: ChatPanel): Promise<number | undefined> => {
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
    // Ctrl+C stops the agent's session while it is open, else the command of the step running; and the sequence.
    context.busy(() => {
      interrupt.asked = true;
      if (inSession) stopRun?.();
      else steps.abort();
    });
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
        ask: (question) => panel.ask(question),
        onMessage: (listener) => {
          sending = listener;
        },
        close: closeSession,
      });
    const startedAt = Date.now();
    // The agent's card turns a spinner while it runs; the chat keeps only what the run says.
    context.spin(agent.id, true);
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
      });
      done();
      ended(code);
      const how = code === 0 ? bold('código 0') : warn(`código ${String(code)}`);
      panel.answer(`${agent.id} terminou: ${how} ${gray(`· ${duration(Date.now() - startedAt)}`)}`);
      return code;
    } catch (error) {
      // An error nothing expected ends this run in the conversation; the panel stays usable for the next one.
      done();
      ended(1);
      panel.answer(warn(`${agent.id} parou por um erro: ${error instanceof Error ? error.message : String(error)}`));
      return 1;
    }
  };

  /** Where the sequence stopped: kept for /resume and said, when the session has more than one agent. */
  const stopped = (ids: readonly string[], at: number, panel: ChatPanel): void => {
    const id = ids[at];
    if (ids.length < 2 || id === undefined) return;
    context.set(RESUME_AT, String(at));
    const ticket = context.get(TICKET);
    const kept = ticket === undefined ? '' : `, com o ticket ${ticket}`;
    panel.answer(warn(`A sequência parou em ${id}. /resume retoma dele${kept}.`));
  };

  /**
   * Runs the session's agents from the one at `from`, the first with `task`; the others, and the first without it,
   * with their default task, else the message that started the sequence.
   */
  const runFrom = async (from: number, task: string | undefined, panel: ChatPanel): Promise<void> => {
    const ids = sessionAgentIds(context);
    const project = context.get(PROJECT);
    const letGo = ids.length > 1 && project !== undefined ? holdApp(project) : noop;
    running = true;
    interrupt.asked = false;
    context.set(RESUME_AT, undefined);
    // What starts the sequence is the task of the agents after the first that have none of their own.
    if (task !== undefined && from === 0) message = task;
    // The agents about to run wait again on their cards.
    for (const id of ids.slice(from)) context.set(agentKey(STATE, id), undefined);
    showRun(container, context);
    // The session's agents are read again at each step: one added while the sequence goes runs at its end.
    const agentAt = (at: number): string | undefined => sessionAgentIds(context)[at];
    try {
      for (let at = from, id = agentAt(at); id !== undefined; at += 1, id = agentAt(at)) {
        const agent = sessionAgent(container, id);
        if (agent === undefined) {
          panel.answer(warn(`O agente ${id} não carrega mais: veja com choliba check.`));
          stopped(sessionAgentIds(context), at, panel);
          return;
        }
        current = id;
        const own = at === from ? task : undefined;
        const code = await runOne(agent, own ?? agent.defaultTask ?? message, panel);
        current = undefined;
        if (code !== 0 || interrupted()) {
          stopped(sessionAgentIds(context), at, panel);
          return;
        }
        const next = agentAt(at + 1);
        if (next !== undefined && !(await goOn(next, panel))) {
          stopped(sessionAgentIds(context), at + 1, panel);
          return;
        }
      }
    } finally {
      running = false;
      current = undefined;
      letGo();
    }
  };

  talks.set(context, {
    running: () => running,
    current: () => current,
    resume: (panel, from, task) => {
      if (!running) void runFrom(from, task, panel);
    },
  });
  context.converse((text, panel) => {
    if (running) sending?.(text);
    else void runFrom(0, text, panel);
  });
}

/** The agent of the session running now, if any. */
export function runningAgent(context: PanelContext): string | undefined {
  return talks.get(context)?.current();
}

/** Whether the session's agents run now: a sequence going, or one agent. */
export function sequenceRunning(context: PanelContext): boolean {
  return talks.get(context)?.running() === true;
}

/**
 * `/resume`: runs the session's sequence again from its agent at `from`, with `task` for it (its own task without
 * one), with the session's ticket; nothing while it runs.
 */
export function resumeSequence(context: PanelContext, panel: ChatPanel, from: number, task?: string): void {
  talks.get(context)?.resume(panel, from, task);
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
