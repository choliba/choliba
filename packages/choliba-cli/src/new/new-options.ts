import { UsageError } from '../common';

/** The providers the choliba runs agents with (`CHOL_AGENTS_PROVIDER`). */
export const PROVIDERS = ['auto', 'claude', 'cursor'] as const;
export type Provider = (typeof PROVIDERS)[number];

/** The agents of the choliba repository the assistant offers to install. */
export const AGENTS = ['product-owner', 'test-writer', 'implementer'] as const;
export type AgentName = (typeof AGENTS)[number];

/** Where the choliba and its agents come from: the rolling release and the repository. */
export const CHOLIBA_PACKAGE = 'https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz';
export const AGENTS_SOURCE = 'github:choliba/choliba';

/** What `choliba new` was told on the command line; what is missing is asked (or defaulted with --no-input). */
export interface NewOptions {
  readonly dir?: string;
  readonly provider?: Provider;
  /** The agents to install; `[]` with `--no-agents`. */
  readonly agents?: readonly AgentName[];
  /** Where the mcp-app server is (for the product-owner); `''` to leave it for later. */
  readonly mcpAppDir?: string;
  readonly choliba: string;
  readonly agentsFrom: string;
  readonly noInput: boolean;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], flag: string): T {
  const found = allowed.find((item) => item === value);
  if (found === undefined) throw new UsageError(`${flag} aceita ${allowed.join(', ')} (veio "${value}").`);
  return found;
}

function agentList(value: string): readonly AgentName[] {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
    .map((name) => oneOf(name, AGENTS, '--agents'));
}

/** `--flag value` or `--flag=value`; the value of a flag that needs one. */
function valueOf(flag: string, arg: string, rest: string[]): string {
  if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
  const value = rest.shift();
  if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} precisa de um valor.`);
  return value;
}

/** The arguments after `choliba new`. */
export function parseNewOptions(argv: readonly string[]): NewOptions {
  const rest = [...argv];
  const options: { -readonly [K in keyof NewOptions]: NewOptions[K] } = {
    choliba: CHOLIBA_PACKAGE,
    agentsFrom: AGENTS_SOURCE,
    noInput: false,
  };
  for (let arg = rest.shift(); arg !== undefined; arg = rest.shift()) {
    const flag = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (flag === '--no-input') options.noInput = true;
    else if (flag === '--no-agents') options.agents = [];
    else if (flag === '--provider') options.provider = oneOf(valueOf(flag, arg, rest), PROVIDERS, flag);
    else if (flag === '--agents') options.agents = agentList(valueOf(flag, arg, rest));
    else if (flag === '--mcp-app-dir') options.mcpAppDir = valueOf(flag, arg, rest);
    else if (flag === '--choliba') options.choliba = valueOf(flag, arg, rest);
    else if (flag === '--agents-from') options.agentsFrom = valueOf(flag, arg, rest);
    else if (arg.startsWith('-')) throw new UsageError(`opção desconhecida: ${arg}.`);
    else if (options.dir === undefined) options.dir = arg;
    else throw new UsageError(`só uma pasta por vez (veio também "${arg}").`);
  }
  return options;
}
