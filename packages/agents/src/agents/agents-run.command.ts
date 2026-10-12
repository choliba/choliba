import type { CommandEntry, ShellCommand } from '@choliba/core';

import { AGENTS } from './agents.constants';

/** How `choliba run --help` lists `agent` when the workspace's agents cannot be read. */
const RUN_ENTRY: CommandEntry = {
  name: 'agent',
  description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/)',
  group: 'Commands',
  spec: { usage: 'choliba run agent AGENT [OPTIONS] [TASK...]' },
};

/** `run agent`, with the spec it builds from the workspace now: the agents on disk, their flags and values. */
export function runAgentEntry(helpSpec: () => CommandEntry['spec']): CommandEntry {
  try {
    return { ...RUN_ENTRY, spec: helpSpec() };
  } catch {
    return RUN_ENTRY;
  }
}

/** `choliba run agent <agent> [OPTIONS] [TASK...]`: its flags as typed. */
export const runAgentCommand: ShellCommand = {
  verb: 'run',
  name: 'agent',
  help: (container) => [runAgentEntry(() => container.get(AGENTS).helpSpec())],
  run: async (container, io) => {
    io.exit(await container.get(AGENTS).run(io.args('run', 'agent')));
  },
};
