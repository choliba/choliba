import { messageOf, PLATFORM, WORKSPACE_ROOT, type ChatPanel, type Container, type PanelContext } from '@choliba/core';
import { sandboxConfig } from '@choliba/sandbox';

import { AUTO, EXECUTION_MODES, type AgentDefinition, type AgentProvider, type ExecutionMode } from '../common';
import { resolveAgentsDir } from './agent-dirs';
import { loadAgent } from './agent-loader';
import { agentCard, agentPaint } from './agents-panel-card';
import { agentsConfig } from './agents-config';
import { AGENT_PROVIDERS } from './agents.constants';
import { isSandboxChoice, type SandboxChoice } from './runs/agents-flags';
import { agentRunChoice } from './runs/run-choice';

/**
 * What the panel's session keeps about its runs, the context keys of each choice. `AGENT` holds the session's agents,
 * in the order they run, their ids joined by `,`: one is a run of that agent alone. `PROVIDER` and `MODEL` are the
 * panel's, which /provider and /model choose; an agent may have its own, chosen as it is added (`agentKey`), which
 * take their place for it. The mode and the sandbox are the session's.
 */
export const AGENT = 'agente';
export const PROVIDER = 'provider';
export const MODEL = 'modelo';
export const MODE = 'modo';
export const SANDBOX = 'sandbox';

/** The context key of how the last run of an agent went, as its card says it: `estado:<id>`. */
export const STATE = 'estado';

/** The context key of the provider or the model chosen for `agent` alone: `provider:<id>`, `modelo:<id>`. */
export function agentKey(choice: typeof PROVIDER | typeof MODEL | typeof STATE, agent: string): string {
  return `${choice}:${agent}`;
}

/** The panel's model when none is chosen: each agent runs the first model it declares. */
export const PANEL_MODEL_DEFAULT = 'padrão de cada agente';

/** The provider a run of `agent` asks for: the one chosen for it as it was added, else the panel's. */
function askedProvider(context: Pick<PanelContext, 'get'>, agent: AgentDefinition): string | undefined {
  return context.get(agentKey(PROVIDER, agent.id)) ?? context.get(PROVIDER);
}

/** The model a run of `agent` asks for: the one chosen for it, else the panel's. */
function askedModel(context: Pick<PanelContext, 'get'>, agent: AgentDefinition): string | undefined {
  return context.get(agentKey(MODEL, agent.id)) ?? context.get(MODEL);
}

/** The ids of the session's agents, in the order they run; none before /agents. */
export function sessionAgentIds(context: Pick<PanelContext, 'get'>): readonly string[] {
  return (context.get(AGENT) ?? '').split(',').filter((id) => id !== '');
}

/** The context keys `/projects` and `/tickets` of `@choliba/projects` set. */
export const PROJECT = 'projeto';
export const TICKET = 'ticket';

/** `[name, value]`, or nothing when there is no value or the agent does not take it. */
export function flag(name: string, value: string | undefined, taken = true): readonly string[] {
  return value === undefined || !taken ? [] : [name, value];
}

/**
 * The command line after `choliba run agent` for `task`: the agent, then the project it takes and `ticket` (its ticket
 * flags), then the provider, the model, the mode and the sandbox chosen in the session (one left at its default is no
 * flag: the run decides, as it would on the command line).
 */
export function sessionArgv(
  context: PanelContext,
  agent: AgentDefinition,
  ticket: readonly string[],
  task: string,
): readonly string[] {
  return [
    agent.id,
    ...flag('--project', context.get(PROJECT), agent.projectRequired),
    ...ticket,
    ...flag('--provider', askedProvider(context, agent)),
    ...flag('--model', askedModel(context, agent)),
    ...flag('--mode', context.get(MODE)),
    ...flag('--sandbox', context.get(SANDBOX)),
    task,
  ];
}

export const bold = (text: string): string => `\u001b[1m\u001b[36m${text}\u001b[39m\u001b[22m`;
export const gray = (text: string): string => `\u001b[90m${text}\u001b[39m`;
export const warn = (text: string): string => `\u001b[33m${text}\u001b[39m`;

/** The workspace's agents folder, as `choliba run agent` finds it: `CHOL_AGENTS_DIR`, else `.choliba/agents`. */
export function agentsDir(container: Container): string {
  return resolveAgentsDir(
    undefined,
    { CHOL_AGENTS_DIR: container.get(agentsConfig.token).agentsDir },
    container.get(WORKSPACE_ROOT),
  );
}

/**
 * The active agent, the first of the session's, read again from its folder; nothing when none is chosen or it no
 * longer loads.
 */
export function activeAgent(container: Container, context: PanelContext): AgentDefinition | undefined {
  const [id] = sessionAgentIds(context);
  return id === undefined ? undefined : sessionAgent(container, id);
}

/** The agent `id` of the session, read again from its folder; nothing when it no longer loads. */
export function sessionAgent(container: Container, id: string): AgentDefinition | undefined {
  try {
    return loadAgent(agentsDir(container), id);
  } catch {
    return undefined;
  }
}

/** The provider `agent` asks for: its own, else the panel's (`panelProviderChoice`). */
export function providerChoice(container: Container, context: PanelContext, agent: AgentDefinition): string {
  return askedProvider(context, agent) ?? container.get(agentsConfig.token).provider;
}

/** The panel's provider: the one chosen with /provider, else `CHOL_AGENTS_PROVIDER`. */
export function panelProviderChoice(container: Container, context: PanelContext): string {
  return context.get(PROVIDER) ?? container.get(agentsConfig.token).provider;
}

/** The provider `choice` names on this machine (under `auto`, the first installed), or nothing when none is. */
export function installedProvider(container: Container, choice: string): AgentProvider | undefined {
  try {
    return container.get(AGENT_PROVIDERS).resolve(choice, container.get(PLATFORM).which).adapter;
  } catch {
    return undefined;
  }
}

/**
 * The provider and the model a run of `agent` takes in the session, as `choliba run agent` picks them from the
 * providers the agent declares (`agentRunChoice`): its own, else the panel's, unless `ask` names the model.
 */
export function sessionRun(
  container: Container,
  context: PanelContext,
  agent: AgentDefinition,
  ask: { readonly model?: string | undefined } = {},
): ReturnType<typeof agentRunChoice> {
  return agentRunChoice(
    agent,
    {
      provider: askedProvider(context, agent),
      model: 'model' in ask ? ask.model : askedModel(context, agent),
      preference: container.get(agentsConfig.token).provider,
    },
    container.get(AGENT_PROVIDERS),
    container.get(PLATFORM).which,
  );
}

/** The modes the session moves through: the active agent's, or every mode before one is chosen. */
function sessionModes(agent: AgentDefinition | undefined): readonly ExecutionMode[] {
  return agent?.modes ?? EXECUTION_MODES;
}

/**
 * The mode a run takes: the one chosen with /mode or Shift+Tab when the agent takes it, else its `modes.default`;
 * with no agent yet, the one chosen, else `execute`.
 */
export function modeChoice(context: PanelContext, agent: AgentDefinition | undefined): ExecutionMode {
  const chosen = context.get(MODE);
  return sessionModes(agent).find((mode) => mode === chosen) ?? agent?.defaultMode ?? 'execute';
}

/**
 * The modes in the status line: the current one bold, the others in gray, and the key that moves it. They are split by
 * `|`, as `·` splits the status line's parts (the mode, the sandbox, the time).
 */
function modeLine(modes: readonly ExecutionMode[], current: ExecutionMode): string {
  const shown = modes.map((mode) => (mode === current ? bold(mode) : gray(mode))).join(gray(' | '));
  return `${gray('modo')} ${shown} ${gray('(shift+tab alterna)')}`;
}

/** The mode, then the sandbox, in the status line: the session's from its start, the agent's once one is chosen. */
function showMode(container: Container, context: PanelContext, agent: AgentDefinition | undefined): void {
  context.status(MODE, modeLine(sessionModes(agent), modeChoice(context, agent)));
  showSandbox(container, context);
}

/**
 * The provider and the model a run of `agent` would take, as the header's column and its card show them, in its color,
 * and what would stop it.
 */
function runLabels(
  container: Container,
  context: PanelContext,
  agent: AgentDefinition,
): { readonly provider: string; readonly model: string; readonly problem?: string } {
  const run = sessionRun(container, context, agent);
  if ('error' in run) return { provider: warn('indisponível'), model: gray('—'), problem: run.error };
  const { id } = run.resolved.adapter;
  // In the agent's color, as its name and its lines.
  const painted = agentPaint(container, agent);
  const named = `${painted(id)}${providerChoice(container, context, agent) === AUTO ? gray(' (auto)') : ''}`;
  return { provider: named, model: painted(run.model) };
}

/** The panel's provider and model, as the header's column shows them: the provider in yellow when it is not installed. */
function panelLabels(
  container: Container,
  context: PanelContext,
): { readonly provider: string; readonly model: string } {
  const choice = panelProviderChoice(container, context);
  const adapter = installedProvider(container, choice);
  if (adapter === undefined) return { provider: warn(choice), model: gray('—') };
  const model = context.get(MODEL);
  return {
    provider: `${bold(adapter.id)}${choice === AUTO ? gray(' (auto)') : ''}`,
    model: model === undefined ? gray(PANEL_MODEL_DEFAULT) : bold(model),
  };
}

/** The agents whose cards each session shows: a card of an agent no longer in the session is taken out. */
const carded = new WeakMap<PanelContext, readonly string[]>();

/**
 * Shows what a run would take, found as `choliba run agent` finds it: the mode and the sandbox in the status line and
 * the panel's provider and model in the header's column, from the session's start; with agents, a card per agent of
 * the session, in its order, with the provider and the model it takes and how its last run went. What would stop a run
 * shows as one word in yellow, its reason written in the `panel`'s chat, so the header keeps its size.
 */
export function showRun(container: Container, context: PanelContext, panel?: Pick<ChatPanel, 'write'>): void {
  showMode(container, context, activeAgent(container, context));
  const shown = panelLabels(container, context);
  context.label(PROVIDER, shown.provider);
  context.label(MODEL, shown.model);
  const ids = sessionAgentIds(context);
  for (const gone of (carded.get(context) ?? []).filter((id) => !ids.includes(id))) context.show(gone, undefined);
  carded.set(context, ids);
  ids.forEach((id, at) => {
    const each = sessionAgent(container, id);
    if (each === undefined) return;
    const labels = runLabels(container, context, each);
    if (labels.problem !== undefined) panel?.write(warn(labels.problem));
    const state = context.get(agentKey(STATE, id));
    context.show(id, agentCard(container, each, labels, { at, state }, context.get(TICKET)));
  });
}

/** The sessions whose Shift+Tab already moves the mode: the key is listened to once per session. */
const listening = new WeakSet<PanelContext>();

/** Makes Shift+Tab move the mode to the next one, around, among the active agent's or every mode; once per session. */
export function listenModeKey(container: Container, context: PanelContext): void {
  if (listening.has(context)) return;
  listening.add(context);
  context.onKey((key) => {
    if (key.name !== 'tab' || key.shift !== true) return false;
    const agent = activeAgent(container, context);
    const modes = sessionModes(agent);
    const next = modes[(modes.indexOf(modeChoice(context, agent)) + 1) % modes.length];
    context.set(MODE, next);
    showRun(container, context);
    return true;
  });
}

/** Why a run cannot use `choice` here: Docker is not installed; nothing when it can. */
export function sandboxProblem(container: Container, choice: SandboxChoice): string | undefined {
  return choice === 'docker' && container.get(PLATFORM).which('docker') === null
    ? 'O sandbox docker precisa do comando docker, que não foi encontrado: instale o Docker ou use local.'
    : undefined;
}

/** Where a run of the session puts the provider: the one chosen with /sandbox, else `CHOL_SANDBOX`, or why neither. */
export function sandboxChoice(container: Container, context: PanelContext): SandboxChoice | { readonly error: string } {
  let value = context.get(SANDBOX);
  try {
    value ??= container.get(sandboxConfig.token).mode;
  } catch (error) {
    return { error: messageOf(error) };
  }
  return isSandboxChoice(value) ? value : { error: `CHOL_SANDBOX="${value}" não existe: use local ou docker.` };
}

/**
 * The sandbox selected, in the status line after the mode: `sandbox local`, in yellow when no run could go there
 * (Docker missing, a wrong `CHOL_SANDBOX`). Set again, it moves after the parts already there, so it follows the mode.
 */
export function showSandbox(container: Container, context: PanelContext): void {
  const choice = sandboxChoice(container, context);
  const shown =
    typeof choice !== 'string'
      ? warn('indisponível')
      : sandboxProblem(container, choice) === undefined
        ? bold(choice)
        : warn(choice);
  context.status(SANDBOX, undefined);
  context.status(SANDBOX, `${gray('sandbox')} ${shown}`);
}
