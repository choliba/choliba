import type { AgentDefinition } from './agent.types';

/**
 * `execute` runs with `policy`. `plan` and `ask` are always forced to `read-only` regardless
 * of `policy` — see `effectivePolicy` in `define-command.ts` — because asking a provider to
 * "just plan" or "just answer" is meaningless if it can also edit files while doing so.
 */
export type ExecutionMode = 'execute' | 'plan' | 'ask';

/** Neutral, provider-agnostic permission level. Each provider adapter maps this to its own flags. */
export type PermissionPolicy = 'read-only' | 'edits';

export interface PromptInput {
  readonly task: string;
  readonly repoRoot: string;
  readonly agent: AgentDefinition;
}

export interface CommandPrepareInput extends PromptInput {
  readonly mode: ExecutionMode;
  /** Git ref for diff base; only used by a `git_diff` in `before_execute`. */
  readonly since?: string;
}

export interface CommandPrepareResult {
  readonly task: string;
  readonly promptBody: string;
}

export interface CommandDefinition {
  /** The name used on the CLI: `agents <name> ...`. */
  readonly name: string;
  /** The agent this command invokes — must be loadable from the configured agents dir. */
  readonly agent: string;
  readonly description: string;
  /** Only meaningful for `execute`; `plan`/`ask` are always read-only. */
  readonly policy: PermissionPolicy;
  readonly defaultMode: ExecutionMode;
  readonly taskRequired: boolean;
  /** Extra directories the provider may read/write, beyond the repo root. Absolute or relative to it. */
  readonly addDirs: readonly string[];
  readonly prompt: (input: PromptInput) => string;
  /** When set, runs before building the user prompt. Required for commands that must preload context (e.g. diff). */
  readonly prepare?: (input: CommandPrepareInput) => CommandPrepareResult;
  /** When set, runs after a successful `execute` run — e.g. persist state for a later `--since pending`. */
  readonly afterExecuteSuccess?: (repoRoot: string) => void;
}
