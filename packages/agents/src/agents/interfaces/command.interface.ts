import type { AgentDefinition } from './agent.interface';
import type { StepFailure } from '../../steps/actions';

/**
 * `execute` runs with `policy`. `plan` and `ask` are always forced to `read-only` regardless
 * of `policy` — see `effectivePolicy` in `define-command.ts` — because asking a provider to
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

export interface CommandPrepareInput extends PromptInput {
  readonly mode: ExecutionMode;
  /** Git ref for diff base; only used by a `git_diff` in `before_execute`. */
  readonly since?: string;
  /** `--dry-run`: run nothing; what the steps would add to the prompt is shown as a marker instead. */
  readonly dryRun?: boolean;
}

/** What the steps that run after the agent need: where, in which mode, and how the agent ended. */
export interface CommandAfterInput {
  readonly repoRoot: string;
  readonly mode: ExecutionMode;
  readonly exitCode: number;
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
  /**
   * When set, runs before building the user prompt. Required for commands that must preload context (e.g. diff).
   * A failed step throws `StepFailedError`: the run stops there, before the agent.
   */
  readonly prepare?: (input: CommandPrepareInput) => CommandPrepareResult;
  /**
   * When set, runs after the agent, whatever the mode and however it ended (e.g. check the tests, persist state
   * for a later `--since pending`, clean up). Returns the steps that failed; none failing is an empty list.
   */
  readonly after?: (input: CommandAfterInput) => readonly StepFailure[];
}
