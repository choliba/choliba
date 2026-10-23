import { configSettings, type ConfigSetting } from '@choliba/config';
import {
  CONFIG_CATALOG,
  formatRows,
  PLATFORM,
  type CommandEntry,
  type CommandSpec,
  type ShellCommand,
} from '@choliba/shell';

import { workspaceConfigSources, workspaceRootOrNothing } from './config-sources';

const SPEC: CommandSpec = {
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

function shownValue(setting: ConfigSetting): string | undefined {
  if (!setting.key.secret) return setting.value;
  return setting.isSet ? 'definida' : undefined;
}

function line(setting: ConfigSetting): string {
  const value = shownValue(setting);
  return value === undefined ? 'não definida' : `${value} (${setting.origin})`;
}

function asJson(settings: readonly ConfigSetting[]): string {
  const entries = settings.map((setting) => [
    setting.key.address.env,
    { valor: shownValue(setting) ?? null, origem: setting.origin },
  ]);
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

const ENTRY: CommandEntry = {
  name: 'config',
  description: 'Lista a configuração em vigor e de onde vem cada valor',
  group: 'Commands',
  spec: SPEC,
};

/** `choliba list config [--json]`. */
export const listConfigCommand: ShellCommand = {
  verb: 'list',
  name: 'config',
  help: () => [ENTRY],
  run: (container, io) => {
    const args = io.args('list', 'config');
    if (io.wantsHelp(args)) {
      io.printHelp(SPEC);
      return Promise.resolve();
    }
    const platform = container.get(PLATFORM);
    const settings = configSettings(container.get(CONFIG_CATALOG), workspaceConfigSources(platform));
    if (args.includes('--json')) {
      io.write(`${asJson(settings)}\n`);
      return Promise.resolve();
    }
    if (workspaceRootOrNothing(platform) === undefined)
      io.warn('Fora de uma pasta de trabalho: sem .env, só o ambiente e os padrões.');
    io.write(`${formatRows(settings.map((setting) => [setting.key.address.env, line(setting)]))}\n`);
    return Promise.resolve();
  },
};
