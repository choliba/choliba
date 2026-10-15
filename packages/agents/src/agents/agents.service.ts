import type { CommandSpec, Platform, ProcessRunnerService, ThemeService } from '@choliba/core';

import type { ProviderRegistry } from '../common';
import { listAgentsSpec } from './runs/agents-spec';
import { agentsHelpSpec, runAgentsCli, runAgentsList } from './runs/run-agents';
import type { RunAgentsCliDeps } from './runs/run-context';

/** What a run reads from the process: where it writes, the clock, the signals, git and the executables on PATH. */
export type AgentsPlatform = Pick<Platform, 'which' | 'clock' | 'stdout' | 'stderr' | 'signals' | 'git'>;

/** `choliba run agent` and `choliba list agents`: the workspace's agents, run through a provider. */
export class AgentsService {
  constructor(
    private readonly workspaceRoot: () => string,
    private readonly config: Readonly<Record<string, string | undefined>>,
    private readonly providers: ProviderRegistry,
    private readonly runner: ProcessRunnerService,
    private readonly theme: ThemeService,
    private readonly platform: AgentsPlatform,
  ) {}

  /** Runs the command line after `choliba run agent`; resolves with the exit code. */
  run(argv: readonly string[]): Promise<number> {
    return runAgentsCli(argv, this.deps());
  }

  /** Lists the agents, from the command line after `choliba list agents`; returns the exit code. */
  list(argv: readonly string[]): number {
    return runAgentsList(argv, this.deps());
  }

  /** `--help` and completion of `choliba list agents`. */
  listHelpSpec(): CommandSpec {
    // Only the providers: no workspace needed, so it also shows outside one.
    return listAgentsSpec({ providers: this.providers });
  }

  /** `--help` and completion: the agents on disk now, their flags and what their values complete to. */
  helpSpec(): CommandSpec {
    return agentsHelpSpec(this.deps());
  }

  private deps(): RunAgentsCliDeps {
    const { which, clock, stdout, stderr, signals, git } = this.platform;
    const repoRoot = this.workspaceRoot();
    return {
      runner: this.runner,
      which,
      providers: this.providers,
      theme: this.theme.theme(),
      repoRoot,
      commands: [],
      config: this.config,
      now: clock,
      stdout,
      stderr,
      signals,
      git,
    };
  }
}
