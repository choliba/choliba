import type { Panel, PanelOptions, ProcessRunnerService, ThemeService } from '@choliba/shell';
import type { Platform, Writable, WritableWithColumns } from '@choliba/kernel';

import type { AgentDefinition } from '@choliba/domain';
import { type ProviderRegistry, type DryRunInput, listAgents } from '@choliba/engine';
import { resolveAgentsDir } from '@choliba/workspace';
import { runAgentsCli, runAgentsList } from './runs/run-agents';
import type { AgentsListHelpHandler, AgentsRunHelpHandlers, RunAgentsCliDeps } from './runs/run-context';
import { type AgentsCliSpecContext, specContext } from './runs/spec-context';
import { ticketTemplatesDir } from '../../projects';

/** What a run reads from the process: where it writes, the clock, the signals, git and the executables on PATH. */
export type AgentsPlatform = Pick<Platform, 'which' | 'clock' | 'stdout' | 'stderr' | 'signals' | 'git'>;

/** What a host lends a run of an agent: its open panel, and where the run's own lines go. */
export interface HostedRun {
  /** The host's open panel, as the run opens it: with its title and the footer it would draw. */
  readonly panel: (options: PanelOptions) => Promise<Panel | undefined>;
  readonly stdout: WritableWithColumns;
  readonly stderr: Writable;
  /** Stops the command of the step running before or after the agent (Ctrl+C in the host's panel). */
  readonly signal?: AbortSignal;
  /** Told the run's ticket when it ends and the ticket is still there (`RunAgentsCliDeps.ticket`). */
  readonly ticket?: (ticket: string) => void;
}

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
  run(argv: readonly string[], help?: AgentsRunHelpHandlers): Promise<number> {
    return runAgentsCli(argv, { ...this.deps(), ...(help === undefined ? {} : { help }) });
  }

  /**
   * Runs the command line after `choliba run agent` inside a host's open panel (`choliba panel`): the run draws in
   * `host.panel`, says what it says before and after in `host.stdout` and `host.stderr`, and prints no frame at the end.
   */
  runHosted(argv: readonly string[], host: HostedRun): Promise<number> {
    return runAgentsCli(argv, {
      ...this.deps(),
      stdout: host.stdout,
      stderr: host.stderr,
      panel: host.panel,
      hostedPanel: true,
      ...(host.signal === undefined ? {} : { signal: host.signal }),
      ...(host.ticket === undefined ? {} : { ticket: host.ticket }),
    });
  }

  /**
   * What `choliba run agent <argv> --dry-run` would show, as data (the panel shows the sandbox's mounts from it); or
   * what it says instead when the command line would not run. Nothing runs and nothing is written.
   */
  async preview(argv: readonly string[]): Promise<DryRunInput | string> {
    let shown: DryRunInput | undefined;
    const said: string[] = [];
    const sink = { write: (chunk: string) => said.push(chunk), isTTY: false as const, columns: 100 };
    await runAgentsCli([...argv, '--dry-run'], {
      ...this.deps(),
      stdout: sink,
      stderr: sink,
      preview: (input) => {
        shown = input;
      },
    });
    return shown ?? said.join('').trim();
  }

  /** Lists the agents, from the command line after `choliba list agents`; returns the exit code. */
  list(argv: readonly string[], help?: AgentsListHelpHandler): number {
    return runAgentsList(argv, { ...this.deps(), ...(help === undefined ? {} : { listHelp: help }) });
  }

  /** The workspace data the app needs to build `choliba run agent` help and completion. */
  helpContext(agents?: readonly AgentDefinition[]): AgentsCliSpecContext {
    const deps = this.deps();
    const agentsDir = resolveAgentsDir(undefined, this.config, this.workspaceRoot());
    return specContext(agents ?? listAgents(agentsDir), deps);
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
      ticketTemplatesDir: ticketTemplatesDir(),
    };
  }
}
