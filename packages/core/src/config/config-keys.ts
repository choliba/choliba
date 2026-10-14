import { DEFAULT_AGENTS_DIR, DEFAULT_MCPS_DIR, DEFAULT_SKILLS_DIR } from './layout';
import {
  CHOL_AGENTS_DIR,
  CHOL_AGENTS_PROVIDER,
  CHOL_COLORS,
  CHOL_GLOBAL_DIR,
  CHOL_MCPS_DIR,
  CHOL_NETWORK,
  CHOL_OLLAMA_URL,
  CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR,
  CHOL_PROJECTS_DIR,
  CHOL_SANDBOX,
  CHOL_SANDBOX_IMAGE,
  CHOL_SKILLS_DIR,
  CHOL_TICKET_RUNS,
} from './vars';

/** One key of the workspace `.env`, as `choliba list config` shows it. */
export interface ConfigKey {
  readonly name: string;
  /** What it is for, in a few words of pt-BR. */
  readonly description: string;
  /** What choliba uses when nothing sets it, in words; absent when nothing is used. */
  readonly fallback?: string;
  /** The values it takes, when they are a closed list. */
  readonly values?: readonly string[];
  /** A credential: its value is never shown, only whether it is set. */
  readonly secret: boolean;
}

/**
 * Every key a workspace `.env` may set, in the order the `.env` reference lists them (`docs/referencia/env.md`, which a
 * spec keeps in step with this list, with the `.env` template and with the defaults other packages keep).
 */
export const CONFIG_KEYS: readonly ConfigKey[] = [
  { name: CHOL_GLOBAL_DIR, description: 'raiz dos artefatos e, sem CHOL_PROJECTS_DIR, dos projetos', secret: false },
  {
    name: CHOL_PROJECTS_DIR,
    description: 'pasta dos projetos',
    fallback: 'CHOL_GLOBAL_DIR/projects',
    secret: false,
  },
  { name: CHOL_TICKET_RUNS, description: 'raiz de ticket-runs/', fallback: 'CHOL_PROJECTS_DIR', secret: false },
  { name: CHOL_AGENTS_DIR, description: 'pasta dos agentes', fallback: DEFAULT_AGENTS_DIR, secret: false },
  { name: CHOL_SKILLS_DIR, description: 'pasta das skills', fallback: DEFAULT_SKILLS_DIR, secret: false },
  { name: CHOL_MCPS_DIR, description: 'pasta dos MCPs', fallback: DEFAULT_MCPS_DIR, secret: false },
  {
    name: CHOL_AGENTS_PROVIDER,
    description: 'provider padrão dos agentes',
    fallback: 'auto',
    values: ['auto', 'claude', 'claude-ollama', 'cursor'],
    secret: false,
  },
  {
    name: CHOL_SANDBOX,
    description: 'onde o provider roda',
    fallback: 'local',
    values: ['local', 'docker'],
    secret: false,
  },
  { name: CHOL_SANDBOX_IMAGE, description: 'imagem do sandbox docker', fallback: 'choliba-agent', secret: false },
  {
    name: CHOL_NETWORK,
    description: 'rede do sandbox docker',
    fallback: 'isolated',
    values: ['isolated', 'host'],
    secret: false,
  },
  {
    name: CHOL_OLLAMA_URL,
    description: 'onde o provider claude-ollama encontra o Ollama',
    fallback: 'http://localhost:11434',
    secret: false,
  },
  { name: 'CLAUDE_CODE_OAUTH_TOKEN', description: 'token do provider claude', secret: true },
  { name: 'CURSOR_API_KEY', description: 'chave do provider cursor', secret: true },
  {
    name: CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR,
    description: 'onde a ferramenta playwright-cli grava os arquivos',
    fallback: '.cache/playwright-cli',
    secret: false,
  },
  { name: CHOL_COLORS, description: 'cores do choliba (papel.nome=cor)', secret: false },
];

/** Where the value in effect comes from: the process environment, the workspace `.env`, the default, or nowhere. */
export type ConfigOrigin = 'ambiente' | '.env' | 'padrão' | 'nenhum';

/** One key with the value in effect and its origin. */
export interface ConfigSetting {
  readonly key: ConfigKey;
  readonly value: string | undefined;
  readonly origin: ConfigOrigin;
}

/**
 * Every key with the value in effect and where it comes from, in the precedence `loadRepoConfig` applies: the process
 * environment over the workspace `.env` (`file`, absent outside a workspace) over the default.
 */
export function configSettings(
  file: Readonly<Record<string, string>> | undefined,
  environment: Readonly<Record<string, string | undefined>>,
): readonly ConfigSetting[] {
  return CONFIG_KEYS.map((key) => {
    const fromEnvironment = environment[key.name];
    const fromFile = file?.[key.name];
    // Bun loads the `.env` of the folder it starts in into the process environment: a value equal to the file's is the
    // file's, and only one the environment sets on its own, or sets differently, is the environment's.
    if (fromEnvironment !== undefined && fromEnvironment !== fromFile) {
      return { key, value: fromEnvironment, origin: 'ambiente' };
    }
    if (fromFile !== undefined) return { key, value: fromFile, origin: '.env' };
    if (key.fallback !== undefined) return { key, value: key.fallback, origin: 'padrão' };
    return { key, value: undefined, origin: 'nenhum' };
  });
}
