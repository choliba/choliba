import { PLATFORM, WORKSPACE_ROOT, type ChatPanel, type Container, type PanelContext } from '@choliba/core';

import { AUTO, type AgentDefinition, type AgentProvider, type ExecutionMode } from '../common';
import { resolveAgentsDir } from './agent-dirs';
import { loadAgent } from './agent-loader';
import { agentsConfig } from './agents-config';
import { AGENT_PROVIDERS } from './agents.constants';
import { providerModel } from './runs/provider-model';

/** What the panel's session keeps about a run of an agent: the context keys of each choice. */
export const AGENT = 'agente';
export const PROVIDER = 'provider';
export const MODEL = 'modelo';
export const MODE = 'modo';

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

/**
 * Shows what a run of the active agent would take, found as `choliba run agent` finds it: the provider and the model in
 * the header's column, the mode in the status line. What would stop the run shows as one word in yellow, its reason
 * written in the `panel`'s chat, so the header keeps its size. With no agent, nothing shows.
 */
export function showRun(container: Container, context: PanelContext, panel?: Pick<ChatPanel, 'write'>): void {
  const agent = activeAgent(container, context);
  if (agent === undefined) return;
  context.status(MODE, modeLine(agent, modeChoice(context, agent)));
  const choice = providerChoice(container, context);
  const provider = installedProvider(container, choice);
  if (provider === undefined) {
    context.label(PROVIDER, warn('nenhum instalado'));
    context.label(MODEL, gray('—'));
    panel?.write(warn(`Nenhum provider instalado para ${choice}: o agente não roda nesta máquina.`));
    return;
  }
  context.label(PROVIDER, `${bold(provider.id)}${choice === AUTO ? gray(' (auto)') : ''}`);
  const model = modelFor(container, provider, context.get(MODEL), agent);
  if ('error' in model) {
    context.label(MODEL, warn('indisponível'));
    panel?.write(warn(model.error));
    return;
  }
  context.label(MODEL, model.model === undefined ? gray(`padrão do ${provider.id}`) : bold(model.model));
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
