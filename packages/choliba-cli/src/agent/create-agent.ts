import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { WorkspaceError } from '../new/new-options';
import type { Prompter } from '../new/prompter';
import type { RunCommand } from '../runtime/interfaces/runtime.interface';
import { ACCESS, ACCESS_LABELS, type Access, type AgentNewOptions, agentName, DEFAULT_MODELS } from './agent-options';
import { agentYaml, type AgentSpec } from './agent-yaml';

export interface WriteAgentDeps {
  /** The workspace root: the agent goes to its `.choliba/agents/`. */
  readonly root: string;
  readonly prompter: Prompter;
  readonly say: (line: string) => void;
}

export interface CreateAgentDeps extends WriteAgentDeps {
  readonly run: RunCommand;
}

export interface WrittenAgent {
  readonly name: string;
  readonly file: string;
  /** Whether it acts on a project: its runs take `--project`. */
  readonly project: boolean;
}

export interface CreatedAgent extends WrittenAgent {
  /** Whether `choliba check` found nothing wrong. */
  readonly checked: boolean;
}

async function askName(options: AgentNewOptions, prompter: Prompter): Promise<string> {
  return options.name ?? agentName(await prompter.text('Nome do agente (a pasta e o comando)?', 'NOME'));
}

async function askProject(options: AgentNewOptions, prompter: Prompter): Promise<boolean> {
  if (options.project !== undefined) return options.project;
  const answer = await prompter.select(
    'Ele age sobre um projeto (--project)?',
    [
      { value: 'sim', label: 'sim: usa a aplicação de um projeto' },
      { value: 'nao', label: 'não: trabalha com o que o prompt traz' },
    ],
    'sim',
  );
  return answer === 'sim';
}

async function askAccess(options: AgentNewOptions, project: boolean, prompter: Prompter): Promise<Access> {
  if (!project) return 'nada';
  return (
    options.access ??
    prompter.select(
      'O que ele pode fazer no projeto?',
      ACCESS.map((value) => ({ value, label: ACCESS_LABELS[value] })),
      'leitura',
    )
  );
}

/** Everything the agent needs, from `options` or asked; nothing written yet. */
async function agentSpec(options: AgentNewOptions, prompter: Prompter): Promise<AgentSpec> {
  const name = await askName(options, prompter);
  const description =
    options.description ?? (await prompter.text('O que ele faz, numa frase (a descrição)?', '--description'));
  const role = options.role ?? (await prompter.text('Quem ele é, numa frase (o papel)?', '--role'));
  const models =
    options.models ??
    (await prompter.text('Com que modelos ele roda (separados por vírgula)?', '--models', DEFAULT_MODELS.join(', ')))
      .split(',')
      .map((model) => model.trim())
      .filter((model) => model !== '');
  const project = await askProject(options, prompter);
  return { name, description, role, models, project, access: await askAccess(options, project, prompter) };
}

/**
 * A new agent in the workspace, `.choliba/agents/<name>/agent.yaml`, from what `options` says or what is asked. An
 * agent that already exists is never touched.
 */
export async function writeAgent(options: AgentNewOptions, deps: WriteAgentDeps): Promise<WrittenAgent> {
  const spec = await agentSpec(options, deps.prompter);
  const dir = path.join(deps.root, '.choliba', 'agents', spec.name);
  if (existsSync(dir)) throw new WorkspaceError(`o agente ${spec.name} já existe (${dir}); escolha outro nome.`);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'agent.yaml');
  writeFileSync(file, agentYaml(spec));
  deps.say(`agente criado: ${file}`);
  return { name: spec.name, file, project: spec.project };
}

/** `choliba-cli agent new`: the new agent, then `choliba check`. */
export async function createAgent(options: AgentNewOptions, deps: CreateAgentDeps): Promise<CreatedAgent> {
  const agent = await writeAgent(options, deps);
  deps.say('conferindo: bunx choliba check');
  return { ...agent, checked: deps.run('bunx', ['choliba', 'check'], deps.root) === 0 };
}

/** The summary on stdout: where the agent is, what to write in it, and how to try it. */
export function formatCreatedAgent(agent: CreatedAgent): string {
  const status = agent.checked ? '' : ' (o `choliba check` apontou o que corrigir, acima)';
  const project = agent.project ? ' --project PROJETO' : '';
  return (
    `Agente ${agent.name} criado${status}: ${agent.file}\n\n` +
    'Próximos passos:\n' +
    '  1. Troque os CHANGE_ME do agent.yaml (o que ele recebe, como trabalha e o que entrega).\n' +
    `  2. Veja o que ele faria, sem rodar: bunx choliba ${agent.name}${project} --dry-run --show-prompt "a tarefa"\n`
  );
}
