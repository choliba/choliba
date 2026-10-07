// What every part of a run shares: its dependencies, the parsed command line, and how a run stops.

import { isAbsolute, join } from 'node:path';

import type { GitRunner } from '@choliba/core/platform';
import type { Theme } from '@choliba/core/theme';
import { resolveLocations, type ProjectSettings, type RunningApp } from '@choliba/projects';
import type { ProcessRunnerService, SignalSource, Writable } from '@choliba/terminal';

import type { ParsedAgentsArgs } from '../agents/dto/run-agent.dto';
import type { CommandDefinition, ExecutionMode } from '../agents/interfaces/command.interface';
import type { ProviderRequest } from '../providers/interfaces/provider.interface';
import type { ProviderRegistry, ResolvedProvider } from '../providers/provider-registry';
import type { RunProject } from './run-project';

export interface RunAgentsCliDeps {
  /**
   * No default: building one needs a `ProcessSpawner`, and the only real one touches the `Bun`
   * global. `cli/main.ts` passes its own; every spec passes a fake.
   */
  readonly runner: ProcessRunnerService;
  /** `Bun.which` in production; a lookup table in specs. */
  readonly which: (bin: string) => string | null;
  /** The providers choliba found (`ProviderRegistryService`); the specs build one from the provider classes. */
  readonly providers: ProviderRegistry;
  /** The colors of what a run prints (`ThemeService`), and whether to color at all. */
  readonly theme: Theme;
  readonly repoRoot: string;
  readonly commands: readonly CommandDefinition[];
  readonly config: Readonly<Record<string, string | undefined>>;
  readonly now: () => Date;
  readonly stdout: Writable;
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
}

export function toAbsolute(path: string, repoRoot: string): string {
  return isAbsolute(path) ? path : join(repoRoot, path);
}

export function errorMessage(error: unknown): string {
  return String(error);
}

export function projectsDir(deps: RunAgentsCliDeps): string {
  return resolveLocations(deps.repoRoot, deps.config, () => undefined).CHOL_PROJECTS_DIR;
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
  readonly providerRequest: ProviderRequest;
}

/** The common arguments of every run of this command, resolved once before the first one. */
export interface RunContext {
  readonly parsed: RunArgs;
  readonly deps: RunAgentsCliDeps;
  readonly agentsDir: string;
  readonly vars: Readonly<Record<string, string>>;
  /** The project of `--project`; absent without one. */
  readonly project?: RunProject;
  readonly mode: ExecutionMode;
  readonly task: string;
  readonly planContent: string | undefined;
  /** The command comes from `agent.yaml` (not from code), so each run derives it from its agent. */
  readonly synthesized: boolean;
}
