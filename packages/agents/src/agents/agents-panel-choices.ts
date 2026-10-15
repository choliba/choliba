import type { ChatPanel, Container, PanelCommand, PanelContext } from '@choliba/core';

import { AUTO, type AgentDefinition, type AgentProvider } from '../common';
import {
  activeAgent,
  bold,
  installedProvider,
  MODE,
  modeChoice,
  MODEL,
  modelFor,
  PROVIDER,
  providerChoice,
  showRun,
  warn,
} from './agents-panel-state';
import { AGENT_PROVIDERS } from './agents.constants';
import { MODE_CHOICES } from './runs/agents-flags';

/** Why a choice about the active agent cannot be made yet. */
const NO_AGENT = 'Escolha um agente antes, com /agents';

/** What each provider is on this machine: `auto` the one it would take, the others whether they are installed. */
function providerDetail(container: Container, choice: string): string {
  const found = installedProvider(container, choice);
  if (choice === AUTO) return found === undefined ? 'nenhum instalado' : `o primeiro instalado: ${found.id}`;
  return found === undefined ? 'não instalado' : 'instalado';
}

/** `/provider`: who runs the agent, for this session; `auto` takes the first installed. */
const providerCommand: PanelCommand = {
  name: 'provider',
  description: 'Escolhe quem roda o agente',
  run: async ({ container, panel, context }) => {
    const choices = container.get(AGENT_PROVIDERS).choices();
    const active = providerChoice(container, context);
    const chosen = await panel.choose({
      title: 'Escolha o provider',
      description: 'Quem roda o agente nesta sessão. auto usa o primeiro instalado.',
      options: choices.map((choice) => ({
        label: choice,
        detail: providerDetail(container, choice),
        current: choice === active,
      })),
    });
    const choice = chosen === undefined ? undefined : choices[chosen];
    if (choice === undefined || choice === active) return;
    const provider = installedProvider(container, choice);
    if (provider === undefined) {
      panel.write(warn(`O provider ${choice} não está instalado nesta máquina.`));
      return;
    }
    context.set(PROVIDER, choice);
    panel.write(`Provider: ${bold(choice)}.`);
    keepModel(container, context, provider, panel);
    showRun(container, context, panel);
  },
};

/** Back to the agent's own model when the chosen one does not run on `provider`, saying so. */
function keepModel(
  container: Container,
  context: PanelContext,
  provider: AgentProvider,
  panel: Pick<ChatPanel, 'write'>,
): void {
  const agent = activeAgent(container, context);
  const chosen = context.get(MODEL);
  if (agent === undefined || chosen === undefined) return;
  if (!('error' in modelFor(container, provider, chosen, agent))) return;
  context.set(MODEL, undefined);
  panel.write(warn(`O modelo ${chosen} não roda com ${provider.id}: volta ao padrão.`));
}

/** The models `provider` runs for `agent`: its own default first, when it picks one, then the agent's it runs. */
function modelOptions(
  container: Container,
  provider: AgentProvider,
  agent: AgentDefinition,
): readonly (string | undefined)[] {
  const declared = agent.supportedModels.filter((model) => !('error' in modelFor(container, provider, model, agent)));
  return provider.modelPrefix === undefined ? [undefined, ...declared] : declared;
}

/** The provider and the agent `/model` chooses for, or why it cannot. */
function modelSubject(
  container: Container,
  context: PanelContext,
): { readonly provider: AgentProvider; readonly agent: AgentDefinition } | string {
  const agent = activeAgent(container, context);
  if (agent === undefined) return NO_AGENT;
  const provider = installedProvider(container, providerChoice(container, context));
  if (provider === undefined) return 'Nenhum provider instalado: escolha um com /provider';
  if (modelOptions(container, provider, agent).length === 0) {
    return `O provider ${provider.id} não roda nenhum modelo de ${agent.id}`;
  }
  return { provider, agent };
}

/** `/model`: the model the agent asks for, among those the chosen provider runs; its default when it picks one. */
const modelCommand: PanelCommand = {
  name: 'model',
  description: 'Escolhe o modelo do agente',
  unavailable: (context, container) => {
    const subject = modelSubject(container, context);
    return typeof subject === 'string' ? subject : undefined;
  },
  run: async ({ container, panel, context }) => {
    const subject = modelSubject(container, context);
    if (typeof subject === 'string') return;
    const { provider, agent } = subject;
    const options = modelOptions(container, provider, agent);
    const active = context.get(MODEL);
    const chosen = await panel.choose({
      title: `Escolha o modelo de ${agent.id}`,
      description: `Os modelos do agente que ${provider.id} roda.`,
      options: options.map((model) => ({
        label: model ?? `padrão do ${provider.id}`,
        detail: model === undefined ? 'o provider escolhe' : '',
        current: model === active,
      })),
    });
    if (chosen === undefined || chosen >= options.length) return;
    const model = options[chosen];
    if (model === active) return;
    context.set(MODEL, model);
    panel.write(`Modelo: ${bold(model ?? `padrão do ${provider.id}`)}.`);
    showRun(container, context, panel);
  },
};

/** `/mode`: how the agent runs, among the modes it takes; Shift+Tab moves it too. */
const modeCommand: PanelCommand = {
  name: 'mode',
  description: 'Escolhe o modo do agente (Shift+Tab alterna)',
  unavailable: (context, container) => (activeAgent(container, context) === undefined ? NO_AGENT : undefined),
  run: async ({ container, panel, context }) => {
    const agent = activeAgent(container, context);
    if (agent === undefined) return;
    const active = modeChoice(context, agent);
    const chosen = await panel.choose({
      title: `Escolha o modo de ${agent.id}`,
      description: 'Como o agente roda a tarefa.',
      options: agent.modes.map((mode) => ({ label: mode, detail: MODE_CHOICES[mode], current: mode === active })),
    });
    const mode = chosen === undefined ? undefined : agent.modes[chosen];
    if (mode === undefined || mode === active) return;
    context.set(MODE, mode);
    panel.write(`Modo: ${bold(mode)}.`);
    showRun(container, context, panel);
  },
};

/** The choices about a run of the active agent that `choliba panel` takes. */
export const runChoices: readonly PanelCommand[] = [providerCommand, modelCommand, modeCommand];
