import {
  type GitRunner,
  type Panel,
  type PanelOptions,
  type ProcessRunnerService,
  type SignalSource,
  type Theme,
  type Writable,
  type WritableWithColumns,
} from '@choliba/core';
import type { ProjectSettings } from '@choliba/projects';
import type { RunningApp } from '@choliba/runner';
import type { Sandbox } from '@choliba/sandbox';

import type { ParsedAgentsArgs } from './agents-flags';
import type { DryRunInput } from './dry-run';
import type { RunLog } from './run-log';
import type { AppReachDeps } from './app-reach';
import type { AgentInvocation, PrepareRunDeps, RunProject } from '@choliba/engine';
import type { ExecutionMode } from '../../common';

export { errorMessage, projectsDir, toAbsolute } from '@choliba/engine';
export type { PreparedRun, Stopped } from '@choliba/engine';

export interface RunAgentsCliDeps extends PrepareRunDeps {
  /**
   * No default: building one needs a `ProcessSpawner`, and the only real one touches the `Bun`
   * global. `cli/main.ts` passes its own; every spec passes a fake.
   */
  readonly runner: ProcessRunnerService;
  /** The colors of what a run prints (`ThemeService`), and whether to color at all. */
  readonly theme: Theme;
  readonly commands: readonly AgentInvocation[];
  readonly stdout: WritableWithColumns;
  readonly signals: SignalSource;
  /** Reads branches and tags for `--since` completion; defaults to spawning the real `git`. */
  readonly git?: GitRunner;
  /** Where each run's log goes, in a folder per agent (`run-log.ts`); defaults to `<repoRoot>/.cache/logs`. */
  readonly logsDir?: string;
  /**
   * Makes sure the project's application is up for a run with `--project` (`ensureApp` of `@choliba/runner`,
   * logging to `.cache/app/`); the specs pass a fake.
   */
  readonly ensureApp?: (settings: ProjectSettings) => Promise<RunningApp>;
  /** Whether a container reaches the application (`containerReachProblem`); this machine's own, by default. */
  readonly appReach?: AppReachDeps;
  /** Opens the panel a run is drawn in on a terminal; `openOpenTuiPanel` when absent. */
  readonly panel?: (options: PanelOptions) => Promise<Panel | undefined>;
  /** `true` when `panel` lends a host's open panel, which keeps the conversation: no frame is printed at the end. */
  readonly hostedPanel?: boolean;
  /** Takes what `--dry-run` would show, in place of printing it: a host that shows it its own way (the panel). */
  readonly preview?: (input: DryRunInput) => void;
  /**
   * Told the ticket of the run once it ends, when the ticket is still there (created with `--type` and filled, or given
   * with `--ticket`): the panel makes it the session's, so the next agent of a sequence works on it.
   */
  readonly ticket?: (ticket: string) => void;
}

export type RunArgs = Extract<ParsedAgentsArgs, { kind: 'run' }>;

/** The common arguments of every run of this command, resolved once before the first one. */
export interface RunContext {
  readonly parsed: RunArgs;
  readonly deps: RunAgentsCliDeps;
  readonly agentsDir: string;
  /** Where the provider runs (`CHOL_SANDBOX`), which decides the addresses the agent is given (`agentURL`). */
  readonly sandbox: Sandbox;
  readonly vars: Readonly<Record<string, string>>;
  /** The project of `--project`; absent without one. */
  readonly project?: RunProject;
  readonly mode: ExecutionMode;
  readonly task: string;
  readonly planContent: string | undefined;
  /** The command comes from `agent.yaml` (not from code), so each run derives it from its agent. */
  readonly synthesized: boolean;
  /**
   * The run's log (`run-log.ts`), and `stdout` and `stderr` as they were before it: the run's screen writes them,
   * logging what it writes itself (`runAgent`). `NO_RUN_LOG` until a real run opens one, and in `--dry-run`.
   */
  readonly log: {
    readonly log: RunLog;
    readonly stdout: WritableWithColumns;
    readonly stderr: Writable;
  };
}
