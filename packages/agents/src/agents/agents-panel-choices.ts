import type { ChatPanel, Container, PanelCommand, PanelContext } from '@choliba/core';

import { AUTO, type AgentDefinition, type AgentProvider } from '../common';
import {
  activeAgent,
  bold,
  installedProvider,
  MODE,
  modeChoice,
  MODEL,
  PROVIDER,
  providerChoice,
  SANDBOX,
  sandboxChoice,
  sandboxProblem,
  sessionRun,
  showRun,
  warn,
} from './agents-panel-state';
import { AGENT_PROVIDERS } from './agents.constants';
import { MODE_CHOICES, SANDBOX_CHOICES, type SandboxChoice } from './runs/agents-flags';
import { declaredModels } from './runs/run-choice';

/** Why a choice about the active agent cannot be made yet. */
const NO_AGENT = 'Escolha um agente antes, com /agents';

/** What each provider is on this machine: `auto` the one it would take for the agent, the others whether installed. */
function providerDetail(container: Container, context: PanelContext, choice: string): string {
  const agent = activeAgent(container, context);
  if (choice === AUTO) {
    const run =
      agent === undefined ? undefined : sessionRun(container, context, agent, { provider: AUTO, model: undefined });
    const found =
      run === undefined ? installedProvider(container, AUTO) : 'error' in run ? undefined : run.resolved.adapter;
    return found === undefined ? 'nenhum instalado' : `o primeiro instalado: ${found.id}`;
  }
  return installedProvider(container, choice) === undefined ? 'não instalado' : 'instalado';
}

/** What /provider offers: `auto` and the providers the active agent declares; every provider with no agent. */
function providerChoices(container: Container, context: PanelContext): readonly string[] {
  const agent = activeAgent(container, context);
  return agent === undefined
    ? container.get(AGENT_PROVIDERS).choices()
    : [AUTO, ...agent.providers.map(({ id }) => id)];
}

/** `/provider`: who runs the agent, for this session, among those it declares; `auto` takes the first installed. */
const providerCommand: PanelCommand = {
  name: 'provider',
  description: 'Escolhe quem roda o agente',
  run: async ({ container, panel, context }) => {
    const choices = providerChoices(container, context);
    const active = providerChoice(container, context);
    const chosen = await panel.choose({
      title: 'Escolha o provider',
      description: 'Quem roda o agente nesta sessão, entre os que ele declara. auto usa o primeiro instalado.',
      options: choices.map((choice) => ({
        label: choice,
        detail: providerDetail(container, context, choice),
        current: choice === active,
      })),
    });
    const choice = chosen === undefined ? undefined : choices[chosen];
    if (choice === undefined || choice === active) return;
    if (choice !== AUTO && installedProvider(container, choice) === undefined) {
      panel.write(warn(`O provider ${choice} não está instalado nesta máquina.`));
      return;
    }
    context.set(PROVIDER, choice);
    panel.write(`Provider: ${bold(choice)}.`);
    keepModel(container, context, panel);
    showRun(container, context, panel);
  },
};

/** Back to the provider's default when the chosen model is not one the agent declares for the new provider. */
function keepModel(container: Container, context: PanelContext, panel: Pick<ChatPanel, 'write'>): void {
  const agent = activeAgent(container, context);
  const chosen = context.get(MODEL);
  if (agent === undefined || chosen === undefined) return;
  const run = sessionRun(container, context, agent, { model: undefined });
  if ('error' in run || declaredModels(agent, run.resolved.adapter.id).includes(chosen)) return;
  context.set(MODEL, undefined);
  panel.write(warn(`O modelo ${chosen} não é de ${run.resolved.adapter.id} no agente: volta ao padrão.`));
}

/** The models `provider` runs for `agent`: its own default first, when it has one, then the ones the agent declares. */
function modelOptions(provider: AgentProvider, agent: AgentDefinition): readonly (string | undefined)[] {
  const declared = declaredModels(agent, provider.id);
  return provider.needsModel ? declared : [undefined, ...declared];
}

/** The provider and the agent `/model` chooses for, or why it cannot. */
function modelSubject(
  container: Container,
  context: PanelContext,
): { readonly provider: AgentProvider; readonly agent: AgentDefinition } | string {
  const agent = activeAgent(container, context);
  if (agent === undefined) return NO_AGENT;
  const run = sessionRun(container, context, agent, { model: undefined });
  return 'error' in run ? run.error : { provider: run.resolved.adapter, agent };
}

/** `/model`: the model the agent asks for, among those it declares for the session's provider; its default too. */
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
    const options = modelOptions(provider, agent);
    const active = context.get(MODEL);
    const chosen = await panel.choose({
      title: `Escolha o modelo de ${agent.id}`,
      description: `Os modelos que o agente declara para ${provider.id}.`,
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

/** The values of `--sandbox`, in the order /sandbox lists them. */
const SANDBOXES: readonly SandboxChoice[] = ['local', 'docker'];

/** `/sandbox`: where the provider runs, for this session; with no choice, `CHOL_SANDBOX` decides. */
const sandboxCommand: PanelCommand = {
  name: 'sandbox',
  description: 'Escolhe onde o provider roda',
  run: async ({ container, panel, context }) => {
    const active = sandboxChoice(container, context);
    const chosen = await panel.choose({
      title: 'Escolha o sandbox',
      description: 'Onde o provider roda nesta sessão. O padrão vem de CHOL_SANDBOX.',
      options: SANDBOXES.map((sandbox) => ({
        label: sandbox,
        detail: sandboxProblem(container, sandbox) === undefined ? SANDBOX_CHOICES[sandbox] : 'Docker não encontrado',
        current: sandbox === active,
      })),
    });
    const sandbox = chosen === undefined ? undefined : SANDBOXES[chosen];
    if (sandbox === undefined || sandbox === active) return;
    const problem = sandboxProblem(container, sandbox);
    if (problem !== undefined) {
      panel.write(warn(problem));
      return;
    }
    context.set(SANDBOX, sandbox);
    panel.write(`Sandbox: ${bold(sandbox)}.`);
  },
};

/** The choices about a run of the active agent that `choliba panel` takes. */
export const runChoices: readonly PanelCommand[] = [providerCommand, modelCommand, modeCommand, sandboxCommand];
