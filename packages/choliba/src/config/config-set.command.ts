import { configSettings, writeConfig, type ConfigKey, type ConfigSetting } from '@choliba/config';
import {
  CONFIG_CATALOG,
  messageOf,
  PLATFORM,
  type CommandEntry,
  type CommandSpec,
  type Platform,
  type ShellCommand,
  type ShellIo,
} from '@choliba/core';

import { workspaceConfigSources, workspaceRootOrNothing } from './config-sources';

const SPEC: CommandSpec = {
  usage: 'choliba set config CHAVE [VALOR]',
  description: 'Grava uma chave da configuração no .env da pasta de trabalho.',
  examples: [
    { description: 'Roda o provider num container', command: 'choliba set config CHOL_SANDBOX docker' },
    {
      description: 'Grava uma credencial, digitada sem aparecer na tela',
      command: 'choliba set config CURSOR_API_KEY',
    },
    {
      description: 'Grava uma credencial vinda de outro comando',
      command: 'echo "$CURSOR_API_KEY" | choliba set config CURSOR_API_KEY',
    },
  ],
  details:
    'Uma chave por vez, das que `choliba list config` mostra; uma com lista de valores só aceita um deles. Uma ' +
    'credencial não vai na linha de comando, que fica no histórico do shell: sem VALOR, o choliba pede o valor sem ' +
    'mostrá-lo num terminal, ou o lê do stdin. O ambiente do processo vence o .env: o comando avisa quando ele define ' +
    'a chave com outro valor.',
  flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
};

const ENTRY: CommandEntry = {
  name: 'config',
  description: 'Grava uma chave da configuração no .env',
  group: 'Commands',
  spec: SPEC,
};

async function secretValue(name: string, platform: Platform): Promise<string | undefined> {
  const read = platform.askSecret === undefined ? await platform.readStdin?.() : await platform.askSecret(`${name}: `);
  const value = read?.trim();
  return value === undefined || value === '' ? undefined : value;
}

async function valueOf(
  io: ShellIo,
  platform: Platform,
  key: ConfigKey,
  given: string | undefined,
): Promise<string | undefined> {
  const name = key.address.env;
  if (!key.secret) {
    if (given === undefined) io.usageError(`Falta o valor de ${name}.`, 'choliba set config');
    return given;
  }
  if (given !== undefined) {
    io.fail(
      `${name} é uma credencial e não vai na linha de comando, que fica no histórico do shell. Rode ` +
        `\`choliba set config ${name}\` e digite o valor, ou envie pelo stdin: echo "$VALOR" | choliba set config ${name}.`,
    );
    return undefined;
  }
  const secret = await secretValue(name, platform);
  if (secret === undefined) io.fail(`Nenhum valor recebido para ${name}.`);
  return secret;
}

function previous(setting: ConfigSetting | undefined): string {
  if (setting?.isSet !== true) return 'não definida';
  return `${setting.key.secret ? 'definida' : String(setting.value)}, ${setting.origin}`;
}

export const setConfigCommand: ShellCommand = {
  verb: 'set',
  name: 'config',
  help: () => [ENTRY],
  run: async (container, io) => {
    const args = io.args('set', 'config');
    if (io.wantsHelp(args)) {
      io.printHelp(SPEC);
      return;
    }
    const [name, given, ...rest] = args;
    if (name === undefined || rest.length > 0) {
      io.usageError('Use uma chave e o valor dela: choliba set config CHAVE VALOR.', 'choliba set config');
      return;
    }
    const catalog = container.get(CONFIG_CATALOG);
    const key = catalog.keys.find((candidate) => candidate.address.env === name);
    if (key === undefined) {
      io.fail(
        `Chave desconhecida: ${name}. As chaves são ${catalog.keys.map((candidate) => candidate.address.env).join(', ')}.`,
      );
      return;
    }
    const platform = container.get(PLATFORM);
    if (workspaceRootOrNothing(platform) === undefined) {
      io.fail('Fora de uma pasta de trabalho: não há .env para gravar. Crie uma com `bun add choliba`.');
      return;
    }
    const value = await valueOf(io, platform, key, given);
    if (value === undefined) return;
    const sources = workspaceConfigSources(platform);
    const before = configSettings(catalog, sources).find((setting) => setting.key === key);
    try {
      const written = writeConfig(catalog, sources, name, value);
      io.write(
        key.secret
          ? `${name} gravada em ${written.source} (antes: ${previous(before)}).\n`
          : `${name}=${value} gravado em ${written.source} (antes: ${previous(before)}).\n`,
      );
    } catch (error) {
      io.fail(messageOf(error));
      return;
    }
    if (before?.origin === 'ambiente' && before.value !== value) {
      io.warn(`O ambiente do processo define ${name}${key.secret ? '' : `=${String(before.value)}`} e vence o .env.`);
    }
  },
};
