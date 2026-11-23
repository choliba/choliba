#!/usr/bin/env bun
/**
 * The Choliba's command line, for a project that installed the package:
 *
 *   choliba rounds <id>      runs a round of rounds.definitions
 *   choliba rounds:web       serves the rounds' pages
 *   choliba approvals        reviews the commands the gate denied
 *   choliba clear            empties the logs, workspaces, homes and rounds folders
 *
 * Each command reads the project's choliba.config.ts, from the current
 * folder up.
 */

import { COMMANDS } from '../src/cli/commands';
import { setExitCode, programArguments } from '../src/execute/process';
import { writeErr, writeOut } from '../src/output/stdio';

const help = (): string =>
  [
    'Uso: choliba <comando> [opções]',
    '',
    'Comandos:',
    ...Object.entries(COMMANDS).map(
      ([name, { summary }]) => `  ${name.padEnd(12)} ${summary}`,
    ),
    '',
    'Cada comando aceita --help.',
  ].join('\n');

const argv = programArguments();
const name = argv.at(0);
const rest = argv.slice(1);
const command = name === undefined ? undefined : COMMANDS[name];
if (command !== undefined) {
  await command.run(rest);
} else if (name === undefined || name === '--help' || name === '-h') {
  writeOut(`${help()}\n`);
} else {
  writeErr(`Comando desconhecido: ${name}.\n\n${help()}\n`);
  setExitCode(1);
}
