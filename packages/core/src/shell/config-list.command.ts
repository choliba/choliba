import { configSettings, loadConfigFile, type ConfigSetting } from '../config';
import { formatRows, type CommandEntry, type CommandSpec } from '../help';
import { PLATFORM } from './create-shell';
import type { ShellCommand } from './interfaces/shell.interface';
import { CONFIG } from './shell.constants';

/** `choliba list config [--json]`. */
export const LIST_CONFIG_SPEC: CommandSpec = {
  usage: 'choliba list config [OPTIONS]',
  description: 'Lista a configuração em vigor na pasta de trabalho: cada chave, o valor e de onde ele vem.',
  examples: [
    { description: 'Mostra cada chave com o valor e a origem', command: 'choliba list config' },
    { description: 'O mesmo em JSON, para um script', command: 'choliba list config --json' },
  ],
  details:
    'A origem é `ambiente` (a variável do processo), `.env` (o da pasta de trabalho) ou `padrão` (o que o choliba ' +
    'usa sem nada definido); `não definida` quando nada vale. O ambiente vence o `.env`, que vence o padrão. ' +
    'Credenciais aparecem só como `definida` ou `não definida`, nunca o valor.',
  flags: [
    { name: '--json', description: 'Saída em JSON: { CHAVE: { valor, origem } }' },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  ],
};

/** The value as shown: a credential only says whether it is set. */
function shownValue(setting: ConfigSetting): string | undefined {
  if (!setting.key.secret || setting.value === undefined) return setting.value;
  return 'definida';
}

/** One line of the list: the value in effect, and where it comes from. */
function line(setting: ConfigSetting): string {
  const value = shownValue(setting);
  return value === undefined ? 'não definida' : `${value} (${setting.origin})`;
}

/** The list as JSON: each key with its value (a credential's as `definida`) and origin. */
function asJson(settings: readonly ConfigSetting[]): string {
  const entries = settings.map((setting) => [
    setting.key.name,
    { valor: shownValue(setting) ?? null, origem: setting.origin },
  ]);
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

/** How `choliba list --help` lists `config`. */
const LIST_ENTRY: CommandEntry = {
  name: 'config',
  description: 'Lista a configuração em vigor e de onde vem cada valor',
  group: 'Commands',
  spec: LIST_CONFIG_SPEC,
};

/**
 * `choliba list config [--json]`: every key of the workspace configuration with the value in effect and its origin.
 * Outside a workspace there is no `.env`: it lists the environment and the defaults, and says so on stderr.
 */
export const listConfigCommand: ShellCommand = {
  verb: 'list',
  name: 'config',
  help: () => [LIST_ENTRY],
  run: (container, io) => {
    const args = io.args('list', 'config');
    if (io.wantsHelp(args)) {
      io.printHelp(LIST_CONFIG_SPEC);
      return Promise.resolve();
    }
    const root = container.get(CONFIG).workspaceRootOrNothing();
    const settings = configSettings(root === undefined ? undefined : loadConfigFile(root), container.get(PLATFORM).env);
    if (args.includes('--json')) {
      io.write(`${asJson(settings)}\n`);
      return Promise.resolve();
    }
    if (root === undefined) io.warn('Fora de uma pasta de trabalho: sem .env, só o ambiente e os padrões.');
    io.write(`${formatRows(settings.map((setting) => [setting.key.name, line(setting)]))}\n`);
    return Promise.resolve();
  },
};
