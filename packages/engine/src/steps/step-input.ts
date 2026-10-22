import type { ExecutionMode, PromptInput } from '@choliba/domain';

import type { StepProject } from './step-write-config';

export interface CommandPrepareInput extends PromptInput {
  readonly mode: ExecutionMode;
  /** Git ref for diff base; only used by a `git_diff` in `before_execute`. */
  readonly since?: string;
  /** `--dry-run`: run nothing; what the steps would add to the prompt is shown as a marker instead. */
  readonly dryRun?: boolean;
  /** Stops the command of the step running (Ctrl+C in the panel). */
  readonly signal?: AbortSignal;
}

/** What the steps that run after the agent need: where, in which mode, and how the agent ended. */
export interface CommandAfterInput {
  readonly repoRoot: string;
  readonly mode: ExecutionMode;
  readonly exitCode: number;
  /** Stops the command of the step running (Ctrl+C in the panel). */
  readonly signal?: AbortSignal;
  /** The agent's final answer, when it ran clean: what a `write_files` or `write_config` step saves. */
  readonly answer?: string;
  /** The run's project (`--project`): where a `write_config` step saves. */
  readonly project?: StepProject;
}

export interface CommandPrepareResult {
  readonly task: string;
  readonly promptBody: string;
}
