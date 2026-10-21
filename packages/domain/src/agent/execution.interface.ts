import type { AgentDefinition } from './agent.interface';
export { EXECUTION_MODES } from '../common';
export type { ExecutionMode, PermissionPolicy } from '../common';

/**
 * `execute` runs with `policy`. `plan` and `ask` are always forced to `read-only` regardless
 * of `policy` — see `effectivePolicy` in `agents/invocation.ts` — because asking a provider to
 * "just plan" or "just answer" is meaningless if it can also edit files while doing so.
 */
export interface PromptInput {
  readonly task: string;
  readonly repoRoot: string;
  readonly agent: AgentDefinition;
}
