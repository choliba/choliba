import { AUTO, declaredModels, type AgentProvider } from '@choliba/engine';
import { type AgentDefinition } from '@choliba/domain';
import {
  AGENT_PROVIDERS,
  activeAgent,
  agentKey,
  agentsDir,
  bold,
  installedProvider,
  MODE,
  modeChoice,
  MODEL,
  PANEL_MODEL_DEFAULT,
  panelProviderChoice,
  PROVIDER,
  SANDBOX,
  sandboxChoice,
  sandboxProblem,
  sessionRun,
  showRun,
  warn,
  listAgents,
  MODE_CHOICES,
  SANDBOX_CHOICES,
  type SandboxChoice,
} from '../agents';
import type { Container } from '@choliba/kernel';
import type { ChatPanel, PanelCommand, PanelContext } from '@choliba/shell';

/** Why a choice about the active agent cannot be made yet. */
const NO_AGENT = 'Escolha um agente antes, com /agents';

/** Whether `choice` is installed on this machine, as the provider lists say it. */
function installedDetail(container: Container, choice: string): string {
  return installedProvider(container, choice) === undefined ? 'não instalado' : 'instalado';
}

/**
 * The provider and the model of `agent`, chosen as it is added to the session or changed in it: its provider among
 * those it declares, then its model among those it declares for it. Esc on either leaves the panel's, which the agent
 * must then take. What it cannot take is said back, and the agent keeps the provider and the model it had; nothing
 * when it takes the ones chosen.
 */
export async function chooseAgentRun(
  container: Container,
  context: PanelContext,
  panel: ChatPanel,
  agent: AgentDefinition,
): Promise<string | undefined> {
  const keys = [agentKey(PROVIDER, agent.id), agentKey(MODEL, agent.id)] as const;
  const had = keys.map((key) => context.get(key));
  const refused = (why: string): string => {
    keys.forEach((key, index) => {
      context.set(key, had[index]);
    });
    return why;
  };
  for (const key of keys) context.set(key, undefined);
  const providers = agent.providers.map(({ id }) => id);
  const chosen = await panel.choose({
    title: `Provider de ${agent.id}`,
    description: `Quem roda ${agent.id}, entre os que ele declara. Esc usa o do painel.`,
    options: providers.map((id) => ({ label: id, detail: installedDetail(container, id), current: false })),
  });
  const provider = chosen === undefined ? undefined : providers[chosen];
  if (provider !== undefined) {
    if (installedProvider(container, provider) === undefined) {
      return refused(`o provider ${provider} não está instalado nesta máquina.`);
    }
    context.set(keys[0], provider);
  }
  const run = sessionRun(container, context, agent, { model: undefined });
  if ('error' in run) return refused(run.error);
  const adapter = run.resolved.adapter;
  // Only the ones it declares: the run refuses any other model, the provider's own default included.
  const models = declaredModels(agent, adapter.id);
  const picked = await panel.choose({
    title: `Modelo de ${agent.id}`,
    description: `Os modelos que ${agent.id} declara para ${adapter.id}. Esc usa o do painel.`,
    options: models.map((model) => ({ label: model, detail: '', current: false })),
  });
  if (picked !== undefined) context.set(keys[1], models[picked]);
  const taken = sessionRun(container, context, agent);
  return 'error' in taken ? refused(taken.error) : undefined;
}

/** `/provider`: the panel's provider, for the agents added with none of their own; `auto` takes the first installed. */
const providerCommand: PanelCommand = {
  name: 'provider',
  description: 'Escolhe o provider do painel',
  run: async ({ container, panel, context }) => {
    const choices = container.get(AGENT_PROVIDERS).choices();
    const active = panelProviderChoice(container, context);
    const chosen = await panel.choose({
      title: 'Escolha o provider do painel',
      description: 'Quem roda os agentes que não têm um seu. auto usa o primeiro instalado.',
      options: choices.map((choice) => ({
        label: choice,
        detail: choice === AUTO ? 'o primeiro instalado' : installedDetail(container, choice),
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
    panel.write(`Provider ${bold(choice)} selecionado.`);
    keepModel(container, context, panel);
    showRun(container, context, panel);
  },
};

/** The panel's provider, and the models /model offers for it: its default, when it has one, and the agents'. */
function panelModels(
  container: Container,
  context: PanelContext,
): { readonly provider: AgentProvider; readonly models: readonly (string | undefined)[] } | string {
  const provider = installedProvider(container, panelProviderChoice(container, context));
  if (provider === undefined) return 'O provider do painel não está instalado: escolha outro com /provider';
  let agents: readonly AgentDefinition[] = [];
  try {
    agents = listAgents(agentsDir(container));
  } catch {
    // No agents folder: only the provider's own default.
  }
  const declared = [...new Set(agents.flatMap((agent) => declaredModels(agent, provider.id)))];
  const models = provider.needsModel ? declared : [undefined, ...declared];
  return models.length === 0 ? `Nenhum agente declara modelos de ${provider.id}` : { provider, models };
}

/** Back to the provider's default when the panel's model is not one /model offers for the new provider. */
function keepModel(container: Container, context: PanelContext, panel: Pick<ChatPanel, 'write'>): void {
  const chosen = context.get(MODEL);
  if (chosen === undefined) return;
  const offered = panelModels(container, context);
  if (typeof offered !== 'string' && offered.models.includes(chosen)) return;
  context.set(MODEL, undefined);
  panel.write(warn(`O modelo ${chosen} não é do novo provider: volta ao padrão.`));
}

/** The panel's model as `/model` lists and confirms it. */
function panelModelLabel(model: string | undefined): string {
  return model ?? PANEL_MODEL_DEFAULT;
}

/** `/model`: the panel's model, among the ones the workspace's agents declare for its provider, and its default. */
const modelCommand: PanelCommand = {
  name: 'model',
  description: 'Escolhe o modelo do painel',
  unavailable: (context, container) => {
    const offered = panelModels(container, context);
    return typeof offered === 'string' ? offered : undefined;
  },
  run: async ({ container, panel, context }) => {
    const offered = panelModels(container, context);
    if (typeof offered === 'string') return;
    const { provider, models } = offered;
    const active = context.get(MODEL);
    const chosen = await panel.choose({
      title: 'Escolha o modelo do painel',
      description: `Os modelos que os agentes declaram para ${provider.id}, para os que não têm um seu.`,
      options: models.map((model) => ({
        label: panelModelLabel(model),
        detail: model === undefined ? 'o primeiro que ele declara' : '',
        current: model === active,
      })),
    });
    if (chosen === undefined || chosen >= models.length) return;
    const model = models[chosen];
    if (model === active) return;
    context.set(MODEL, model);
    panel.write(`Modelo ${bold(panelModelLabel(model))} selecionado.`);
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
    panel.write(`Modo ${bold(mode)} selecionado.`);
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
    panel.write(`Sandbox ${bold(sandbox)} selecionado.`);
  },
};

/** The choices about a run of the active agent that `choliba panel` takes. */
export const runChoices: readonly PanelCommand[] = [providerCommand, modelCommand, modeCommand, sandboxCommand];
