import type { CommandEntry, CommandSpec, Container, ShellCommand } from '@choliba/core';

import { AGENT_PROVIDERS, AGENTS } from './agents.constants';
import { runAgentReferenceSpec } from './runs/agents-spec';

/** How `choliba run --help` lists `agent`. */
const RUN_ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'agent',
  description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/)',
  group: 'Commands',
};

/**
 * `run agent`, with the spec it builds from the workspace now (the agents on disk, their flags and values), or, when
 * there is no workspace to read, `reference`: every flag a run takes.
 */
export function runAgentEntry(helpSpec: () => CommandSpec, reference: () => CommandSpec): CommandEntry {
  try {
    return { ...RUN_ENTRY, spec: helpSpec() };
  } catch {
    return { ...RUN_ENTRY, spec: reference() };
  }
}

/** `run agent` as the workspace has it, or, without one, every flag. */
function entryIn(container: Container): CommandEntry {
  return runAgentEntry(
    () => container.get(AGENTS).helpSpec(),
    () => runAgentReferenceSpec({ providers: container.get(AGENT_PROVIDERS) }),
  );
}

/** `choliba run agent <agent> [OPTIONS] [TASK...]`: its flags as typed; `--help` outside a workspace, every flag. */
export const runAgentCommand: ShellCommand = {
  verb: 'run',
  name: 'agent',
  help: (container) => [entryIn(container)],
  run: async (container, io) => {
    const args = io.args('run', 'agent');
    if (args.length === 1 && io.wantsHelp(args)) {
      io.printHelp(entryIn(container).spec);
      return;
    }
    io.exit(await container.get(AGENTS).run(args));
  },
};
