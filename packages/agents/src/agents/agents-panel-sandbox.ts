import { CARD_RULE, PLATFORM, type Container, type PanelCard, type PanelContext } from '@choliba/core';

import type { AgentDefinition } from '../common';
import {
  activeAgent,
  AGENT,
  bold,
  flag,
  gray,
  MODE,
  MODEL,
  PROJECT,
  PROVIDER,
  SANDBOX,
  sandboxChoice,
  sandboxProblem,
  sessionArgv,
  TICKET,
  warn,
} from './agents-panel-state';
import { AGENTS } from './agents.constants';
import { SANDBOX_CHOICES } from './runs/agents-flags';
import { ACCESS_LABEL } from './runs/dry-run';

/** What the program that isolates the provider is, beside the sandbox's name. */
const ENGINE = { local: 'bwrap', docker: 'docker' } as const;

/** `path` with the home folder as `~`, as the header's column shows the workspace. */
function shortPath(path: string, home: string | undefined): string {
  return home !== undefined && home !== '' && path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/**
 * The ticket flags of the preview: the chosen ticket; with none, and an agent that needs one, a new ticket of its first
 * type, which a dry run never writes.
 */
function previewTicket(context: PanelContext, agent: AgentDefinition): readonly string[] {
  const types = agent.ticketTypes;
  const ticket = context.get(TICKET);
  if (types === undefined || ticket !== undefined || agent.allowWithoutTicket) {
    return flag('--ticket', ticket, types !== undefined);
  }
  return flag('--type', types[0]);
}

/**
 * What the active agent's run would see, as `choliba run agent --dry-run` finds it: in a container, its image and
 * network first; then each path with what it is to the agent. What is missing to know it, or that the run would not go
 * with the session's choices, is said instead.
 */
async function reachLines(container: Container, context: PanelContext): Promise<readonly string[]> {
  const agent = activeAgent(container, context);
  if (agent === undefined) return [gray('Escolha um agente para ver o que a execução monta.')];
  if (agent.projectRequired && context.get(PROJECT) === undefined) {
    return [gray(`Escolha um projeto para ver o que ${agent.id} monta.`)];
  }
  const preview = await container
    .get(AGENTS)
    .preview(sessionArgv(context, agent, previewTicket(context, agent), 'prévia'));
  // Why the run would not go is said where it comes from (the model, the provider); the card only says it has no mounts.
  if (typeof preview === 'string') return [gray('A execução não roda com estas escolhas: sem montagens para mostrar.')];
  const home = container.get(PLATFORM).env['HOME'];
  const box = preview.container;
  const mounts = [...(box?.mounts ?? []), ...(preview.local?.mounts ?? [])];
  return [
    ...(box === undefined ? [] : [gray(`imagem ${box.image} · rede ${box.network}`), CARD_RULE]),
    ...mounts.map((mount) => `${gray(ACCESS_LABEL[mount.access])} ${shortPath(mount.path, home)}`),
  ];
}

/** The card's head: the sandbox and its program, what it is, where the choice came from, and what would stop a run. */
function sandboxHead(container: Container, context: PanelContext): Pick<PanelCard, 'lines' | 'summary'> {
  const choice = sandboxChoice(container, context);
  if (typeof choice !== 'string') {
    return { lines: [warn('indisponível'), CARD_RULE, choice.error], summary: [warn('indisponível')] };
  }
  const problem = sandboxProblem(container, choice);
  const name = problem === undefined ? bold(choice) : warn(choice);
  const origin = gray(context.get(SANDBOX) === undefined ? 'padrão (CHOL_SANDBOX)' : 'escolhido nesta sessão');
  const head = `${name} ${gray(`· ${ENGINE[choice]}`)}`;
  return {
    lines: [
      head,
      CARD_RULE,
      `${SANDBOX_CHOICES[choice]}: o provider só vê o que está montado.`,
      origin,
      ...(problem === undefined ? [] : [warn(problem)]),
    ],
    summary: [head, origin],
  };
}

/** Each session's latest refresh: a slower preview that ends after a newer one is dropped. */
const refreshes = new WeakMap<PanelContext, number>();

/**
 * Shows the sandbox card in the header, first, before the project's and the agent's: its head at once, then what the active
 * agent's run would mount, once the preview has it.
 */
export async function showSandboxCard(container: Container, context: PanelContext): Promise<void> {
  const turn = (refreshes.get(context) ?? 0) + 1;
  refreshes.set(context, turn);
  const head = sandboxHead(container, context);
  const card = (reach: readonly string[]): Omit<PanelCard, 'title'> => ({
    ...head,
    lines: [...head.lines, CARD_RULE, ...reach],
    key: 's',
    order: 1,
  });
  context.show(SANDBOX, card([gray('…')]));
  const reach = await reachLines(container, context);
  if (refreshes.get(context) === turn) context.show(SANDBOX, card(reach));
}

/** What changes what a run would mount: the choices of the agent, the project, the ticket and the sandbox. */
const WATCHED = new Set([AGENT, PROJECT, TICKET, PROVIDER, MODEL, MODE, SANDBOX]);

/** The sessions whose sandbox card follows their choices already. */
const watching = new WeakSet<PanelContext>();

/** Shows the sandbox card from the session's start, and again whenever a choice it depends on changes or is cleared. */
export function watchSandbox(container: Container, context: PanelContext): void {
  void showSandboxCard(container, context);
  if (watching.has(context)) return;
  watching.add(context);
  context.onChange((key) => {
    if (key === undefined || WATCHED.has(key)) void showSandboxCard(container, context);
  });
}
