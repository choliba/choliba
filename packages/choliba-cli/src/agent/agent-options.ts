import { UsageError } from '../common';

/** What a new agent may do on its project, from nothing to changing the application and running its tests. */
export const ACCESS = ['nada', 'leitura', 'escrita', 'testes'] as const;
export type Access = (typeof ACCESS)[number];

export const ACCESS_LABELS: Readonly<Record<Access, string>> = {
  nada: 'nada: trabalha só com o que o prompt traz',
  leitura: 'lê a aplicação e os testes do projeto',
  escrita: 'lê e escreve na aplicação',
  testes: 'lê e escreve na aplicação e roda os testes do projeto',
};

/** The models the choliba's own agents list: the Claude one and Cursor's choice. */
export const DEFAULT_MODELS: readonly string[] = ['claude-sonnet-5', 'Auto'];

/** An agent's name, which is also its folder and its command: lowercase letters, digits, `-` and `_`. */
const NAME = /^[a-z0-9][a-z0-9_-]*$/;

/** What `choliba-cli agent new` was told on the command line; what is missing is asked. */
export interface AgentNewOptions {
  readonly name?: string;
  readonly description?: string;
  readonly role?: string;
  readonly models?: readonly string[];
  /** Whether it acts on a project (`--project`); `undefined` to ask. */
  readonly project?: boolean;
  readonly access?: Access;
  readonly noInput: boolean;
}

/** `name`, refused unless it can be an agent's folder and command. */
export function agentName(name: string): string {
  if (!NAME.test(name)) {
    throw new UsageError(`"${name}" não serve de nome de agente: use letras minúsculas, números, - e _.`);
  }
  return name;
}

function list(value: string): readonly string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function valueOf(flag: string, arg: string, rest: string[]): string {
  if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
  const value = rest.shift();
  if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} precisa de um valor.`);
  return value;
}

function access(value: string): Access {
  const found = ACCESS.find((item) => item === value);
  if (found === undefined) throw new UsageError(`--access aceita ${ACCESS.join(', ')} (veio "${value}").`);
  return found;
}

/** The arguments after `choliba-cli agent new`. */
export function parseAgentNewOptions(argv: readonly string[]): AgentNewOptions {
  const rest = [...argv];
  const options: { -readonly [K in keyof AgentNewOptions]: AgentNewOptions[K] } = { noInput: false };
  for (let arg = rest.shift(); arg !== undefined; arg = rest.shift()) {
    const flag = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (flag === '--no-input') options.noInput = true;
    else if (flag === '--project') options.project = true;
    else if (flag === '--no-project') options.project = false;
    else if (flag === '--description') options.description = valueOf(flag, arg, rest);
    else if (flag === '--role') options.role = valueOf(flag, arg, rest);
    else if (flag === '--models') options.models = list(valueOf(flag, arg, rest));
    else if (flag === '--access') options.access = access(valueOf(flag, arg, rest));
    else if (arg.startsWith('-')) throw new UsageError(`opção desconhecida: ${arg}.`);
    else if (options.name === undefined) options.name = agentName(arg);
    else throw new UsageError(`um agente por vez (veio também "${arg}").`);
  }
  if (options.project === false && options.access !== undefined && options.access !== 'nada') {
    throw new UsageError(`--access ${options.access} precisa de um projeto: tire --no-project.`);
  }
  return options;
}
