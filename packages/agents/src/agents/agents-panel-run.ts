import type { ChatPanel, Container, Panel, PanelContext, PanelOptions } from '@choliba/core';

import type { AgentDefinition } from '../common';
import { activeAgent, bold, flag, gray, PROJECT, sessionArgv, TICKET, warn } from './agents-panel-state';
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

/** The sessions whose conversation goes to the active agent already: one per session, whichever agent is active. */
const talking = new WeakSet<PanelContext>();

/**
 * Makes what is sent with no `/` the task of the active agent: it runs as `choliba run agent` would, in the session's
 * panel, with the session's choices. While it runs, what is sent goes to it, its questions are asked in the field, the
 * status line says it runs, and Ctrl+C twice or /clear stop it.
 */
export function talkToAgent(container: Container, context: PanelContext): void {
  if (talking.has(context)) return;
  talking.add(context);
  let sending: ((text: string) => void) | undefined;
  let running = false;
  const start = async (text: string, panel: ChatPanel): Promise<void> => {
    const agent = activeAgent(container, context);
    if (agent === undefined) return;
    const argv = await runArgv(context, agent, text, panel);
    if (argv === undefined) return;
    if (typeof argv === 'string') {
      panel.answer(warn(argv));
      return;
    }
    running = true;
    let stopRun: (() => void) | undefined;
    const done = (): void => {
      running = false;
      sending = undefined;
      context.status(RUN, undefined);
      context.busy(undefined);
    };
    context.busy(() => {
      stopRun?.();
    });
    const hosted = (options: PanelOptions): Promise<Panel> =>
      Promise.resolve({
        write: (line) => {
          panel.write(line);
        },
        refresh: () => {
          context.status(RUN, `${gray('rodando')} ${bold(agent.id)} ${gray(options.footer(80).join(' '))}`);
        },
        onInterrupt: (listener) => {
          stopRun = listener;
        },
        ask: (question) => panel.ask(question),
        onMessage: (listener) => {
          sending = listener;
        },
        close: done,
      });
    const startedAt = Date.now();
    panel.answer(`Rodando ${bold(agent.id)}…`);
    await container
      .get(AGENTS)
      .runHosted(argv, { panel: hosted, stdout: replies(panel, (line) => line), stderr: replies(panel, warn) })
      .then((code) => {
        done();
        const how = code === 0 ? bold('código 0') : warn(`código ${String(code)}`);
        panel.answer(`${agent.id} terminou: ${how} ${gray(`· ${duration(Date.now() - startedAt)}`)}`);
      });
  };
  context.converse((text, panel) => {
    if (running) sending?.(text);
    else void start(text, panel);
  });
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
