import { messageOf, PLATFORM, WORKSPACE_ROOT, type ChatPanel, type Container, type PanelContext } from '@choliba/core';
import { sandboxConfig } from '@choliba/sandbox';

import { AUTO, type AgentDefinition, type AgentProvider, type ExecutionMode } from '../common';
import { resolveAgentsDir } from './agent-dirs';
import { loadAgent } from './agent-loader';
import { agentCard } from './agents-panel-card';
import { agentsConfig } from './agents-config';
import { AGENT_PROVIDERS } from './agents.constants';
import { isSandboxChoice, type SandboxChoice } from './runs/agents-flags';
import { providerModel } from './runs/provider-model';

/** What the panel's session keeps about a run of an agent: the context keys of each choice. */
export const AGENT = 'agente';
export const PROVIDER = 'provider';
export const MODEL = 'modelo';
export const MODE = 'modo';
export const SANDBOX = 'sandbox';

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
    ...flag('--provider', context.get(PROVIDER)),
    ...flag('--model', context.get(MODEL)),
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

/** The active agent, read again from its folder; nothing when none is chosen or it no longer loads. */
export function activeAgent(container: Container, context: PanelContext): AgentDefinition | undefined {
  const id = context.get(AGENT);
  if (id === undefined) return undefined;
  try {
    return loadAgent(agentsDir(container), id);
  } catch {
    return undefined;
  }
}

/** The provider the session runs with: the one chosen with /provider, else `CHOL_AGENTS_PROVIDER`. */
export function providerChoice(container: Container, context: PanelContext): string {
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

/** The model a run asks `provider` for with `chosen` (undefined: the agent's own), or why it cannot. */
export function modelFor(
  container: Container,
  provider: AgentProvider,
  chosen: string | undefined,
  agent: AgentDefinition,
): { readonly model: string | undefined } | { readonly error: string } {
  return providerModel(provider, chosen, agent.supportedModels, container.get(AGENT_PROVIDERS));
}

/** The mode a run takes: the one chosen with /mode or Shift+Tab when the agent takes it, else its `modes.default`. */
export function modeChoice(context: PanelContext, agent: AgentDefinition): ExecutionMode {
  const chosen = context.get(MODE);
  return agent.modes.find((mode) => mode === chosen) ?? agent.defaultMode;
}

/** The modes in the status line: the current one bold, the others in gray, and the key that moves it. */
function modeLine(agent: AgentDefinition, current: ExecutionMode): string {
  const modes = agent.modes.map((mode) => (mode === current ? bold(mode) : gray(mode))).join(gray(' · '));
  return `${gray('modo')} ${modes} ${gray('(shift+tab alterna)')}`;
}

/** The provider and the model a run of `agent` would take, as the header's column shows them, and what would stop it. */
function runLabels(
  container: Container,
  context: PanelContext,
  agent: AgentDefinition,
): { readonly provider: string; readonly model: string; readonly problem?: string } {
  const choice = providerChoice(container, context);
  const provider = installedProvider(container, choice);
  if (provider === undefined) {
    return {
      provider: warn('nenhum instalado'),
      model: gray('—'),
      problem: `Nenhum provider instalado para ${choice}: o agente não roda nesta máquina.`,
    };
  }
  const named = `${bold(provider.id)}${choice === AUTO ? gray(' (auto)') : ''}`;
  const model = modelFor(container, provider, context.get(MODEL), agent);
  if ('error' in model) return { provider: named, model: warn('indisponível'), problem: model.error };
  return { provider: named, model: model.model === undefined ? gray(`padrão do ${provider.id}`) : bold(model.model) };
}

/**
 * Shows what a run of the active agent would take, found as `choliba run agent` finds it: the provider and the model in
 * the header's column, the mode in the status line, and the agent's card, whose collapsed summary says the mode and the
 * model. What would stop the run shows as one word in yellow, its reason written in the `panel`'s chat, so the header
 * keeps its size. With no agent, nothing shows.
 */
export function showRun(container: Container, context: PanelContext, panel?: Pick<ChatPanel, 'write'>): void {
  const agent = activeAgent(container, context);
  if (agent === undefined) return;
  const mode = modeChoice(context, agent);
  context.status(MODE, modeLine(agent, mode));
  const labels = runLabels(container, context, agent);
  context.label(PROVIDER, labels.provider);
  context.label(MODEL, labels.model);
  if (labels.problem !== undefined) panel?.write(warn(labels.problem));
  context.show(AGENT, agentCard(container, agent, `${bold(mode)} ${gray('·')} ${labels.model}`));
}

/** The sessions whose Shift+Tab already moves the mode: the key is listened to once per session. */
const listening = new WeakSet<PanelContext>();

/** Makes Shift+Tab move the active agent's mode to the next one it takes, around, once per session. */
export function listenModeKey(container: Container, context: PanelContext): void {
  if (listening.has(context)) return;
  listening.add(context);
  context.onKey((key) => {
    if (key.name !== 'tab' || key.shift !== true) return false;
    const agent = activeAgent(container, context);
    if (agent === undefined) return false;
    const next = agent.modes[(agent.modes.indexOf(modeChoice(context, agent)) + 1) % agent.modes.length];
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
