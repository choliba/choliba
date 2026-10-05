import { Inject, Injectable } from '@nestjs/common';

import type { CommandSpec } from '@choliba/core/cli';
import { ConfigService, ThemeService } from '@choliba/core/nest';
import {
  CLOCK,
  GIT,
  SIGNALS,
  STDERR,
  STDOUT,
  WHICH,
  type Clock,
  type GitRunner,
  type SignalSource,
  type Which,
  type Writable,
} from '@choliba/core/platform';
import { ProcessRunnerService } from '@choliba/terminal';

import { ProviderRegistryService } from '../providers/provider-registry.service';
import { agentsHelpSpec, runAgentsCli, type RunAgentsCliDeps } from '../runs/run-agents';

/** `choliba agents` (and `choliba <agent>`): the workspace's agents, run through a provider. */
@Injectable()
export class AgentsService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ProviderRegistryService) private readonly providers: ProviderRegistryService,
    @Inject(ProcessRunnerService) private readonly runner: ProcessRunnerService,
    @Inject(ThemeService) private readonly theme: ThemeService,
    @Inject(WHICH) private readonly which: Which,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(STDOUT) private readonly stdout: Writable,
    @Inject(STDERR) private readonly stderr: Writable,
    @Inject(SIGNALS) private readonly signals: SignalSource,
    @Inject(GIT) private readonly git: GitRunner,
  ) {}

  /** Runs the command line after `choliba agents`; resolves with the exit code. */
  run(argv: readonly string[]): Promise<number> {
    return runAgentsCli(argv, this.deps());
  }

  /** `--help` and completion: the agents on disk now, their flags and what their values complete to. */
  helpSpec(): CommandSpec {
    return agentsHelpSpec(this.deps());
  }

  private deps(): RunAgentsCliDeps {
    const repoRoot = this.config.workspaceRoot();
    return {
      runner: this.runner,
      which: this.which,
      providers: this.providers.registry(),
      theme: this.theme.theme(),
      repoRoot,
      commands: [],
      config: this.config.load(repoRoot),
      now: this.clock,
      stdout: this.stdout,
      stderr: this.stderr,
      signals: this.signals,
      git: this.git,
    };
  }
}
