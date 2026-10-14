import { configSettings, configValueError, findConfigKey, loadConfigFile, writeConfigValue } from '../config';
import type { CommandEntry, CommandSpec } from '../help';
import type { Platform } from '../platform';
import { PLATFORM } from './create-shell';
import type { ShellCommand } from './interfaces/shell.interface';
import type { ShellIo } from './shell-io';
import { CONFIG } from './shell.constants';

/** `choliba set config CHAVE [valor]`. */
export const SET_CONFIG_SPEC: CommandSpec = {
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

/** How `choliba set --help` lists `config`. */
const SET_ENTRY: CommandEntry = {
  name: 'config',
  description: 'Grava uma chave da configuração no .env',
  group: 'Commands',
  spec: SET_CONFIG_SPEC,
};

/** A credential's value: asked without showing it at a terminal, or read from stdin; `undefined` when none came. */
async function secretValue(name: string, platform: Platform): Promise<string | undefined> {
  const read = platform.askSecret === undefined ? await platform.readStdin?.() : await platform.askSecret(`${name}: `);
  const value = read?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/** The value to write, or `undefined` after saying on `io` why there is none. */
async function valueOf(
  io: ShellIo,
  platform: Platform,
  name: string,
  given: string | undefined,
): Promise<string | undefined> {
  if (findConfigKey(name)?.secret !== true) {
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

/**
 * `choliba set config CHAVE [valor]`: writes one key into the workspace's `.env`, checked against the registry, and
 * says what it was before. A credential comes from a hidden prompt or stdin, never the command line, and is never shown.
 */
export const setConfigCommand: ShellCommand = {
  verb: 'set',
  name: 'config',
  help: () => [SET_ENTRY],
  run: async (container, io) => {
    const args = io.args('set', 'config');
    if (io.wantsHelp(args)) {
      io.printHelp(SET_CONFIG_SPEC);
      return;
    }
    const [name, given, ...rest] = args;
    if (name === undefined || rest.length > 0) {
      io.usageError('Use uma chave e o valor dela: choliba set config CHAVE VALOR.', 'choliba set config');
      return;
    }
    const unknown = findConfigKey(name) === undefined ? configValueError(name, '') : undefined;
    if (unknown !== undefined) {
      io.fail(unknown);
      return;
    }
    const root = container.get(CONFIG).workspaceRootOrNothing();
    if (root === undefined) {
      io.fail('Fora de uma pasta de trabalho: não há .env para gravar. Crie uma com `bun add choliba`.');
      return;
    }
    const platform = container.get(PLATFORM);
    const value = await valueOf(io, platform, name, given);
    if (value === undefined) return;
    const invalid = configValueError(name, value);
    if (invalid !== undefined) {
      io.fail(invalid);
      return;
    }
    const before = configSettings(loadConfigFile(root), platform.env).find((setting) => setting.key.name === name);
    writeConfigValue(root, name, value);
    const secret = before?.key.secret === true;
    const was =
      before?.value === undefined ? 'não definida' : `${secret ? 'definida' : before.value}, ${before.origin}`;
    io.write(
      secret ? `${name} gravada em .env (antes: ${was}).\n` : `${name}=${value} gravado em .env (antes: ${was}).\n`,
    );
    const fromEnvironment = before?.origin === 'ambiente' ? before.value : undefined;
    if (fromEnvironment !== undefined && fromEnvironment !== value) {
      io.warn(`O ambiente do processo define ${name}${secret ? '' : `=${fromEnvironment}`} e vence o .env.`);
    }
  },
};
