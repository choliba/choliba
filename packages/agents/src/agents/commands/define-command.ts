import type { AgentDefinition } from '../interfaces/agent.interface';
import type { CommandDefinition, ExecutionMode, PermissionPolicy } from '../interfaces/command.interface';
import { buildAfter, buildPrepare } from '../../steps/registry';

export type CommandSpec = Pick<CommandDefinition, 'name' | 'agent' | 'description'> &
  Partial<Omit<CommandDefinition, 'name' | 'agent' | 'description'>>;

const DEFAULT_POLICY: PermissionPolicy = 'read-only';
const DEFAULT_MODE: ExecutionMode = 'execute';

/**
 * Fills in the safe defaults a `CommandSpec` may omit: read-only, execute, task required, no
 * extra directories, and a prompt that is just the task verbatim.
 */
export function defineCommand(spec: CommandSpec): CommandDefinition {
  const command: CommandDefinition = {
    name: spec.name,
    agent: spec.agent,
    description: spec.description,
    policy: spec.policy ?? DEFAULT_POLICY,
    defaultMode: spec.defaultMode ?? DEFAULT_MODE,
    taskRequired: spec.taskRequired ?? true,
    addDirs: spec.addDirs ?? [],
    prompt: spec.prompt ?? ((input) => input.task),
  };
  let result: CommandDefinition = command;
  if (spec.prepare !== undefined) {
    result = { ...result, prepare: spec.prepare };
  }
  if (spec.after !== undefined) {
    result = { ...result, after: spec.after };
  }
  return result;
}

/**
 * Builds a runnable command from an agent loaded from its `agent.yaml`: policy, mode, task
 * requirement and the optional `prepare`/`after` hooks (its `steps`) come from the declaration.
 */
export function commandFromAgent(agent: AgentDefinition): CommandDefinition {
  const spec: CommandSpec = {
    name: agent.name,
    agent: agent.name,
    description: agent.description,
    policy: agent.policy,
    defaultMode: agent.defaultMode,
    taskRequired: agent.taskRequired,
  };
  const prepare = buildPrepare(agent);
  const after = buildAfter(agent);
  let result = defineCommand(spec);
  if (prepare !== undefined) {
    result = { ...result, prepare };
  }
  if (after !== undefined) {
    result = { ...result, after };
  }
  return result;
}

/** Alias for `commandFromAgent` — kept for callers that still import this name. */
export function implicitCommand(agent: AgentDefinition): CommandDefinition {
  return commandFromAgent(agent);
}

/** `plan` and `ask` are always read-only, whatever the command's own `policy` says. */
export function effectivePolicy(command: CommandDefinition, mode: ExecutionMode): PermissionPolicy {
  return mode === 'execute' ? command.policy : 'read-only';
}
