// What every part of a run shares: its dependencies, the parsed command line, and how a run stops.

import { isAbsolute, join } from 'node:path';

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
import { projectLocations, type ProjectLocations, type ProjectSettings, type RunningApp } from '@choliba/projects';
import type { Sandbox } from '@choliba/sandbox';

import type { ParsedAgentsArgs } from './agents-flags';
import type { DryRunInput } from './dry-run';
import type { AgentInvocation } from '../interfaces/invocation.interface';
import type { ExecutionMode } from '../../common';
import type { ProviderRequest } from '../../common';
import type { ProviderRegistry, ResolvedProvider } from '../../common';
import type { RunProject } from '../../common';

export interface RunAgentsCliDeps {
  /**
   * No default: building one needs a `ProcessSpawner`, and the only real one touches the `Bun`
   * global. `cli/main.ts` passes its own; every spec passes a fake.
   */
  readonly runner: ProcessRunnerService;
  /** `Bun.which` in production; a lookup table in specs. */
  readonly which: (bin: string) => string | null;
  /** The providers choliba knows (`AGENT_PROVIDERS`); the specs build one from the provider classes. */
  readonly providers: ProviderRegistry;
  /** The colors of what a run prints (`ThemeService`), and whether to color at all. */
  readonly theme: Theme;
  readonly repoRoot: string;
  readonly commands: readonly AgentInvocation[];
  readonly config: Readonly<Record<string, string | undefined>>;
  readonly now: () => Date;
  readonly stdout: WritableWithColumns;
  readonly stderr: Writable;
  readonly signals: SignalSource;
  /** Reads branches and tags for `--since` completion; defaults to spawning the real `git`. */
  readonly git?: GitRunner;
  /** Where each run's empty folder is made (`ProviderRequest.runDir`); defaults to `<repoRoot>/.cache/runs`. */
  readonly runsDir?: string;
  /**
   * Makes sure the project's application is up for a run with `--project` (`ensureApp` of `@choliba/projects`,
   * logging to `.cache/app/`); the specs pass a fake.
   */
  readonly ensureApp?: (settings: ProjectSettings) => Promise<RunningApp>;
  /** Opens the panel a run is drawn in on a terminal; `openOpenTuiPanel` when absent. */
  readonly panel?: (options: PanelOptions) => Promise<Panel | undefined>;
  /** `true` when `panel` lends a host's open panel, which keeps the conversation: no frame is printed at the end. */
  readonly hostedPanel?: boolean;
  /** Stops the command of the step running: the panel's Ctrl+C, which the steps then report as failed. */
  readonly signal?: AbortSignal;
  /** Takes what `--dry-run` would show, in place of printing it: a host that shows it its own way (the panel). */
  readonly preview?: (input: DryRunInput) => void;
}

export function toAbsolute(path: string, repoRoot: string): string {
  return isAbsolute(path) ? path : join(repoRoot, path);
}

export function errorMessage(error: unknown): string {
  return String(error);
}

export function projectsDir(deps: RunAgentsCliDeps): string {
  return locationsOf(deps.config).CHOL_PROJECTS_DIR;
}

/** The projects group represented in the run's flat provider environment. */
export function locationsOf(config: Readonly<Record<string, string | undefined>>): ProjectLocations {
  return projectLocations({
    globalDir: config['CHOL_GLOBAL_DIR'],
    projectsDir: config['CHOL_PROJECTS_DIR'] ?? '',
    ticketRuns: config['CHOL_TICKET_RUNS'],
  });
}

export type RunArgs = Extract<ParsedAgentsArgs, { kind: 'run' }>;

/** A run that stopped before the agent, and the exit code it ends with (the reason is already on `stderr`). */
export interface Stopped {
  readonly exitCode: number;
}

export const STOPPED: Stopped = { exitCode: 1 };

export interface PreparedRun {
  readonly effectiveTask: string;
  readonly resolved: ResolvedProvider;
  /** The provider came from the agent's own models, not from `--provider` nor the environment. */
  readonly providerFromAgent?: boolean;
  readonly providerRequest: ProviderRequest;
}

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
}
