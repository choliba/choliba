import type { CommandEntry, ShellCommand } from '@choliba/core';

import { AGENTS } from './agents.constants';

/** How `choliba list --help` lists `agents`. */
const LIST_ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'agents',
  description: 'Lista os agentes da pasta de trabalho com os detalhes de cada um',
  group: 'Commands',
};

/** `choliba list agents [--agents-dir DIR]`. */
export const listAgentsCommand: ShellCommand = {
  verb: 'list',
  name: 'agents',
  help: (container) => [{ ...LIST_ENTRY, spec: container.get(AGENTS).listHelpSpec() }],
  run: (container, io) => {
    io.exit(container.get(AGENTS).list(io.args('list', 'agents')));
    return Promise.resolve();
  },
};
