import { isAbsolute, join } from 'node:path';

import type { Writable } from '@choliba/kernel';
import { projectLocations, type ProjectLocations } from '@choliba/projects';
import type { Sandbox } from '@choliba/sandbox';
import type { ExecutionMode } from '@choliba/domain';

import type { ProviderRegistry, ProviderRequest, ResolvedProvider, RunProject } from '../ports';

export interface PrepareRunDeps {
  /** `Bun.which` in production; a lookup table in specs. */
  readonly which: (bin: string) => string | null;
  /** The providers choliba knows; the specs build one from the provider classes. */
  readonly providers: ProviderRegistry;
  readonly repoRoot: string;
  readonly config: Readonly<Record<string, string | undefined>>;
  readonly now: () => Date;
  readonly stderr: Writable;
  /** Where each run's empty folder is made (`ProviderRequest.runDir`); defaults to `<repoRoot>/.cache/runs`. */
  readonly runsDir?: string;
  /** Stops the command of the step running: the panel's Ctrl+C, which the steps then report as failed. */
  readonly signal?: AbortSignal;
}

/** What a run asks of preparation: the flags that change the provider request. */
export interface RunRequest {
  readonly model?: string | undefined;
  readonly provider?: string | undefined;
  readonly addDirs: readonly string[];
  readonly since?: string | undefined;
  readonly dryRun: boolean;
}

export function toAbsolute(path: string, repoRoot: string): string {
  return isAbsolute(path) ? path : join(repoRoot, path);
}

export function errorMessage(error: unknown): string {
  return String(error);
}

export function projectsDir(deps: Pick<PrepareRunDeps, 'config'>): string {
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
  readonly parsed: RunRequest;
  readonly deps: PrepareRunDeps;
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
