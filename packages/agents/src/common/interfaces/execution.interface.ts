import type { AgentDefinition } from './agent.interface';

/**
 * `execute` runs with `policy`. `plan` and `ask` are always forced to `read-only` regardless
 * of `policy` — see `effectivePolicy` in `agents/invocation.ts` — because asking a provider to
 * "just plan" or "just answer" is meaningless if it can also edit files while doing so.
 */
export type ExecutionMode = 'execute' | 'plan' | 'ask';

/** Every mode, in the order the CLI lists them. */
export const EXECUTION_MODES: readonly ExecutionMode[] = ['execute', 'plan', 'ask'];

/** Neutral, provider-agnostic permission level. Each provider adapter maps this to its own flags. */
export type PermissionPolicy = 'read-only' | 'edits';

export interface PromptInput {
  readonly task: string;
  readonly repoRoot: string;
  readonly agent: AgentDefinition;
}
