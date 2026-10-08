import type { AgentDefinition } from '../common';
import type { AgentInvocation } from './interfaces/invocation.interface';
import type { ExecutionMode, PermissionPolicy } from '../common';
import { buildAfter, buildPrepare } from './steps/step-registry';

export type InvocationSpec = Pick<AgentInvocation, 'name' | 'agent' | 'description'> &
  Partial<Omit<AgentInvocation, 'name' | 'agent' | 'description'>>;

const DEFAULT_POLICY: PermissionPolicy = 'read-only';
const DEFAULT_MODE: ExecutionMode = 'execute';

/**
 * Fills in the safe defaults a `InvocationSpec` may omit: read-only, execute, task required, no
 * extra directories, and a prompt that is just the task verbatim.
 */
export function defineInvocation(spec: InvocationSpec): AgentInvocation {
  const command: AgentInvocation = {
    name: spec.name,
    agent: spec.agent,
    description: spec.description,
    policy: spec.policy ?? DEFAULT_POLICY,
    defaultMode: spec.defaultMode ?? DEFAULT_MODE,
    taskRequired: spec.taskRequired ?? true,
    addDirs: spec.addDirs ?? [],
    prompt: spec.prompt ?? ((input) => input.task),
  };
  let result: AgentInvocation = command;
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
export function invocationFromAgent(agent: AgentDefinition): AgentInvocation {
  const spec: InvocationSpec = {
    name: agent.name,
    agent: agent.name,
    description: agent.description,
    policy: agent.policy,
    defaultMode: agent.defaultMode,
    taskRequired: agent.taskRequired,
  };
  const prepare = buildPrepare(agent);
  const after = buildAfter(agent);
  let result = defineInvocation(spec);
  if (prepare !== undefined) {
    result = { ...result, prepare };
  }
  if (after !== undefined) {
    result = { ...result, after };
  }
  return result;
}

/** Alias for `invocationFromAgent` — kept for callers that still import this name. */
export function implicitInvocation(agent: AgentDefinition): AgentInvocation {
  return invocationFromAgent(agent);
}

/** `plan` and `ask` are always read-only, whatever the command's own `policy` says. */
export function effectivePolicy(command: AgentInvocation, mode: ExecutionMode): PermissionPolicy {
  return mode === 'execute' ? command.policy : 'read-only';
}
