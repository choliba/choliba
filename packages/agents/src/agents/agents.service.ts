import type { CommandSpec, ConfigService, Platform, ProcessRunnerService, ThemeService } from '@choliba/core';

import type { ProviderRegistry } from '../common';
import { agentsHelpSpec, runAgentsCli } from './runs/run-agents';
import type { RunAgentsCliDeps } from './runs/run-context';

/** What a run reads from the process: where it writes, the clock, the signals, git and the executables on PATH. */
export type AgentsPlatform = Pick<Platform, 'which' | 'clock' | 'stdout' | 'stderr' | 'signals' | 'git'>;

/** `choliba agents` (and `choliba <agent>`): the workspace's agents, run through a provider. */
export class AgentsService {
  constructor(
    private readonly config: ConfigService,
    private readonly providers: ProviderRegistry,
    private readonly runner: ProcessRunnerService,
    private readonly theme: ThemeService,
    private readonly platform: AgentsPlatform,
  ) {}

  /** Runs the command line after `choliba agents` (or the whole `choliba <agent> …`); resolves with the exit code. */
  run(argv: readonly string[]): Promise<number> {
    return runAgentsCli(argv, this.deps());
  }

  /** `--help` and completion: the agents on disk now, their flags and what their values complete to. */
  helpSpec(): CommandSpec {
    return agentsHelpSpec(this.deps());
  }

  private deps(): RunAgentsCliDeps {
    const repoRoot = this.config.workspaceRoot();
    const { which, clock, stdout, stderr, signals, git } = this.platform;
    return {
      runner: this.runner,
      which,
      providers: this.providers,
      theme: this.theme.theme(),
      repoRoot,
      commands: [],
      config: this.config.load(repoRoot),
      now: clock,
      stdout,
      stderr,
      signals,
      git,
    };
  }
}
