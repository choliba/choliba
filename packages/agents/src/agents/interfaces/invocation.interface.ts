import type { ExecutionMode, PermissionPolicy, PromptInput } from '../../common';
import type { StepFailure } from '../steps/step-actions';

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

export interface AgentInvocation {
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
