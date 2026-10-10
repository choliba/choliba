import type { CommandEntry, CommandSpec, ShellCommand } from '@choliba/core';

import { AGENTS } from './agents.constants';

/** How `choliba --help` lists `agents` when the workspace's agents cannot be read. */
const ENTRY: CommandEntry = {
  name: 'agents',
  description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/); `choliba <agente>` é atalho',
  group: 'Commands',
  spec: { usage: 'choliba agents COMMAND [OPTIONS] [TASK...]' },
};

/** `spec`'s agents, as the root help lists them: `choliba <agent>` shortcuts, not `--<agent>` flags. */
function agentShortcuts(spec: CommandSpec): readonly CommandEntry[] {
  try {
    return (spec.commands?.() ?? [])
      .filter((entry) => entry.group === 'Agents')
      .map((entry) => ({ ...entry, asFlag: false, listed: false }));
  } catch {
    return [];
  }
}

/** `agents`, with the spec it builds from the workspace now, then the workspace's agents as shortcuts. */
export function agentsEntries(helpSpec: () => CommandSpec): readonly CommandEntry[] {
  let spec: CommandSpec;
  try {
    spec = helpSpec();
  } catch {
    return [ENTRY];
  }
  return [{ ...ENTRY, spec }, ...agentShortcuts(spec)];
}

/** `choliba agents <agent> [OPTIONS] [TASK...]`, `agents list`, `agents --help`: its flags as typed. */
export const agentsCommand: ShellCommand = {
  name: 'agents',
  help: (container) => agentsEntries(() => container.get(AGENTS).helpSpec()),
  run: async (container, io) => {
    io.exit(await container.get(AGENTS).run(io.args('agents')));
  },
};
