import type { CommandEntry, CommandSpec, Container, ShellCommand } from '@choliba/core';
import {
  AGENT_PROVIDERS,
  AGENTS,
  formatAgentDetail,
  type AgentsCliSpecContext,
  type AgentsRunHelpHandlers,
} from '@choliba/agents';
import { agentCommandSpec, agentsCliSpec, runAgentReferenceSpec } from './agents-spec';

/** How `choliba run --help` lists `agent`. */
const RUN_ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'agent',
  description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/)',
  group: 'Commands',
};

/** `run agent`, with its workspace spec, or the reference spec when there is no workspace to read. */
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
    () => agentsCliSpec(container.get(AGENTS).helpContext()),
    () => runAgentReferenceSpec({ providers: container.get(AGENT_PROVIDERS) }),
  );
}

function helpHandlers(container: Container, showHelp: (spec: CommandSpec) => void): AgentsRunHelpHandlers {
  return {
    agents: () => {
      showHelp(entryIn(container).spec);
    },
    agent: (command, agent) => {
      const context: AgentsCliSpecContext = container.get(AGENTS).helpContext([agent]);
      showHelp(agentCommandSpec(agent, context, formatAgentDetail(command, agent)));
    },
  };
}

/** `choliba run agent <agent> [OPTIONS] [TASK...]`: its flags as typed. */
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
    io.exit(
      await container.get(AGENTS).run(
        args,
        helpHandlers(container, (spec) => {
          io.printHelp(spec);
        }),
      ),
    );
  },
};
