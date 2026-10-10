import { CONFIG, entryHelp, type CommandEntry, type ShellCommand } from '@choliba/core';

import { allFine, checkWorkspace, formatCheck } from './check';

/** How `choliba --help` lists `check`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'check',
  description: 'Confere a pasta de trabalho: agentes (schemas, skills, MCPs) e projetos',
  group: 'Commands',
  spec: { usage: 'choliba check' },
};

/** `choliba check`: the agents (schemas, skills, MCPs) and the projects of the workspace; exit 1 when any is wrong. */
export const checkCommand: ShellCommand = {
  name: 'check',
  help: () => [ENTRY],
  run: (container, io) => {
    if (io.wantsHelp(io.args('check'))) {
      io.printHelp(entryHelp(ENTRY));
      return Promise.resolve();
    }
    const config = container.get(CONFIG);
    const root = config.workspaceRoot();
    const sections = checkWorkspace(root, config.load(root));
    io.write(`${formatCheck(sections)}\n`);
    io.exit(allFine(sections) ? 0 : 1);
    return Promise.resolve();
  },
};
