import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { messageOf } from '@choliba/core';

import { writeAgent } from '../generate';
import { AGENTS, type AgentName, type NewOptions, PROVIDERS, type Provider } from './new-options';
import { WorkspaceError } from '../common';
import { setEnvValue } from './env-file';
import type { RunCommand } from '../runtime';
import type { Prompter } from '../runtime';

export interface NewDeps {
  readonly cwd: string;
  readonly prompter: Prompter;
  readonly run: RunCommand;
  /** Messages along the way (stderr). */
  readonly say: (line: string) => void;
  /** `choliba add <args>` into the workspace at `dir`: what it installed; throws saying what went wrong. */
  readonly add: (dir: string, args: readonly string[]) => string;
}

/** What `new` did, for the summary on stdout. */
export interface NewResult {
  readonly dir: string;
  readonly provider: Provider;
  readonly agents: readonly AgentName[];
  /** The agent created along the way (`generate agent`), if any. */
  readonly newAgent: string | undefined;
  /** Whether `choliba check` found nothing wrong. */
  readonly checked: boolean;
}

const PROVIDER_LABELS: Readonly<Record<Provider, string>> = {
  auto: 'auto (o primeiro instalado)',
  claude: 'claude',
  cursor: 'cursor',
};

/** The folder to create, which must not exist or be empty: the assistant never mixes with what is there. */
async function workspaceDir(options: NewOptions, deps: NewDeps): Promise<string> {
  const name = options.dir ?? (await deps.prompter.text('Em que pasta criar a pasta de trabalho?', 'PASTA', 'choliba'));
  const dir = path.resolve(deps.cwd, name);
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new WorkspaceError(`a pasta ${dir} já existe e não está vazia; escolha outra.`);
  }
  return dir;
}

function step(deps: NewDeps, dir: string, what: string, command: string, args: readonly string[]): void {
  deps.say(`${what}: ${[command, ...args].join(' ')}`);
  const code = deps.run(command, args, dir);
  if (code !== 0) throw new WorkspaceError(`${what} falhou (código ${String(code)}). A pasta ${dir} ficou como está.`);
}

function editEnv(dir: string, values: Readonly<Record<string, string>>): void {
  const file = path.join(dir, '.env');
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  for (const [key, value] of Object.entries(values)) text = setEnvValue(text, key, value);
  writeFileSync(file, text);
}

/** The mcp-app the product-owner uses: where it is, written to `.env`; `''` leaves it for later. */
async function configureMcpApp(options: NewOptions, dir: string, deps: NewDeps): Promise<void> {
  const answer =
    options.mcpAppDir ??
    (await deps.prompter.text(
      'Onde está o servidor mcp-app (do product-owner)? Vazio deixa para depois.',
      '--mcp-app-dir',
      '',
    ));
  if (answer.trim() === '') {
    deps.say('mcp-app: defina CHOL_MCP_APP_DIR e CHOL_MCP_APP_LOG_DIR no .env antes de rodar o product-owner.');
    return;
  }
  const mcpDir = path.resolve(deps.cwd, answer);
  editEnv(dir, { CHOL_MCP_APP_DIR: mcpDir, CHOL_MCP_APP_LOG_DIR: path.join(mcpDir, 'logs') });
  if (!existsSync(path.join(mcpDir, 'dist', 'main.js'))) {
    deps.say(
      `mcp-app: ${path.join(mcpDir, 'dist', 'main.js')} não existe; compile o mcp-app antes de rodar o product-owner.`,
    );
  }
}

/** The optional `generate agent` step: asked, never with `--no-input` (its default is no). */
async function maybeNewAgent(dir: string, deps: NewDeps): Promise<string | undefined> {
  const answer = await deps.prompter.select(
    'Criar um agente seu agora?',
    [
      { value: 'nao', label: 'não (depois: choliba generate agent)' },
      { value: 'sim', label: 'sim' },
    ],
    'nao',
  );
  if (answer === 'nao') return undefined;
  return (await writeAgent({ noInput: false }, { root: dir, prompter: deps.prompter, say: deps.say })).name;
}

/**
 * `choliba new`: a new workspace, step by step. The folder and its `package.json`; the choliba, whose setup
 * makes the rest of the workspace; the agents' provider in `.env`; the agents of the choliba (and the mcp-app the
 * product-owner needs); optionally a new agent of one's own; and `choliba check` at the end. Every choice comes from `options` or is asked.
 */
export async function newWorkspace(options: NewOptions, deps: NewDeps): Promise<NewResult> {
  const dir = await workspaceDir(options, deps);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify({ name: path.basename(dir), private: true }, null, 2)}\n`,
  );
  step(deps, dir, 'instalando o choliba', 'bun', ['add', '--trust', options.choliba]);

  const provider =
    options.provider ??
    (await deps.prompter.select(
      'Com que provider os agentes rodam?',
      PROVIDERS.map((value) => ({ value, label: PROVIDER_LABELS[value] })),
      'auto',
    ));
  editEnv(dir, { CHOL_AGENTS_PROVIDER: provider });

  const agents =
    options.agents ??
    (await deps.prompter.multiselect(
      'Quais agentes do choliba instalar?',
      AGENTS.map((value) => ({ value, label: value })),
      AGENTS,
    ));
  // Before the install, so the product-owner's mcp-app finds its variables in .env.
  if (agents.includes('product-owner')) await configureMcpApp(options, dir, deps);
  for (const agent of agents) {
    const args = [options.agentsFrom, '--path', `.choliba/agents/${agent}`];
    deps.say(`instalando o ${agent}: choliba add ${args.join(' ')}`);
    try {
      deps.say(deps.add(dir, args));
    } catch (error) {
      throw new WorkspaceError(`instalando o ${agent} falhou: ${messageOf(error)}. A pasta ${dir} ficou como está.`);
    }
  }

  const newAgent = await maybeNewAgent(dir, deps);

  deps.say('conferindo: bunx choliba check');
  const checked = deps.run('bunx', ['choliba', 'check'], dir) === 0;
  return { dir, provider, agents, newAgent, checked };
}

/** The summary on stdout: where the workspace is, and what to do next. */
export function formatSummary(result: NewResult): string {
  const next = result.agents.includes('product-owner')
    ? `  cd ${result.dir}\n  choliba generate project minha-app --app-dir ../minha-app --base-url http://localhost:3000\n  bunx choliba product-owner --project minha-app --type story "o que a aplicação deve fazer"`
    : `  cd ${result.dir}\n  bunx choliba --help`;
  const status = result.checked ? 'pronta' : 'criada, mas o `choliba check` apontou o que corrigir (acima)';
  return `Pasta de trabalho ${status}: ${result.dir}\nProvider: ${result.provider}. Agentes: ${result.agents.length === 0 ? 'nenhum' : result.agents.join(', ')}.\n${result.newAgent === undefined ? '' : `Agente novo: ${result.newAgent} (troque os CHANGE_ME do agent.yaml dele).\n`}\nPróximos passos:\n${next}\n`;
}
