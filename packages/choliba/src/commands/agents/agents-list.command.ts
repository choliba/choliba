import type { CommandEntry, ShellCommand } from '@choliba/shell';
import { AGENT_PROVIDERS, AGENTS } from '../../agents';
import { listAgentsSpec } from './agents-spec';

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
  help: (container) => [{ ...LIST_ENTRY, spec: listAgentsSpec({ providers: container.get(AGENT_PROVIDERS) }) }],
  run: (container, io) => {
    const providers = container.get(AGENT_PROVIDERS);
    io.exit(
      container.get(AGENTS).list(io.args('list', 'agents'), {
        list: () => {
          io.printHelp(listAgentsSpec({ providers }));
        },
      }),
    );
    return Promise.resolve();
  },
};
