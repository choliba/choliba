import { createHash } from 'node:crypto';

import { getConfig } from '../config/index';
import type { ProgramCommand } from '../execute/types';
import { UsageError } from '../errors';
import { ensureDirectory, join, resolve } from '../filesystem/index';
import { compileFilesystemAccess, type AgentPolicy } from '../policy/index';
import {
  NetworkBoundary,
  networkRulesOf,
  validatePorts,
  type NetworkApprover,
  type NetworkLedger,
  type RequestRewriter,
  type TrafficObserver,
} from '../network/index';
import { DEFAULT_DOCKER_IMAGE } from './constants';
import { environment, userHome } from '../execute/process';
import { SandboxPaths } from './sandbox/path-map';
import {
  findPrograms,
  validateProgramNames,
  type ProgramCheck,
} from './sandbox/programs';
import {
  HOST_STATES,
  type HostState,
  type SandboxHost,
} from './sandbox/host-access';

export type { HostState } from './sandbox/host-access';
export type { FoundProgram, ProgramCheck } from './sandbox/programs';
import {
  BubblewrapSandbox,
  DockerSandbox,
  type Sandbox,
} from './sandbox/index';

export type WorkspaceType = 'docker' | 'bubblewrap';

/** What both kinds of workspace take. */
interface CommonWorkspaceOptions {
  readonly root: string;
  readonly writable?: readonly string[];
  /**
   * What of the host's CLI state reaches the sandbox: `'login'` (the
   * default: a home of its own, with only the CLI's login, read-only),
   * `'none'` (not even the login) or `'share'` (the host's state, with every
   * project's history in it). See `HostState`.
   */
  readonly hostState?: HostState;
  /**
   * Where the homes of the workspaces are kept, one per root (see
   * `home()`); `workspaces.homes` of the config by default.
   */
  readonly homes?: string;
  /**
   * Where the agent sees the root, a folder right in `/home` (the only thing
   * there: the host's homes are hidden); `AGENT_ROOT` (`/home/choliba`) by
   * default.
   */
  readonly agentRoot?: string;
  /**
   * The programs the agent sees, by name (`php`, `bun`), even when more are
   * installed: the program folders are emptied and only these come back,
   * plus what Choliba itself runs in the sandbox and the shell. Each must
   * exist, or the sandbox does not start. Without it, every program of the
   * host is visible.
   */
  readonly programs?: readonly string[];
}

export interface DockerWorkspaceOptions extends CommonWorkspaceOptions {
  readonly type: 'docker';
  /** `FROM <image>` or a local `name:tag`; `DEFAULT_DOCKER_IMAGE` by default. */
  readonly image?: string;
  /** See {@link BubblewrapWorkspaceOptions.ports}. */
  readonly ports?: readonly number[];
}

export interface BubblewrapWorkspaceOptions extends CommonWorkspaceOptions {
  readonly type: 'bubblewrap';
  /**
   * Ports of the sandbox you reach at `127.0.0.1:<port>` on the host (e.g. a
   * dev server the agent started). Without network rules the sandbox shares
   * the host's network and they are there already; with them, Choliba opens
   * them. A way in for you, not a way out for the agent.
   */
  readonly ports?: readonly number[];
}

export type WorkspaceOptions =
  DockerWorkspaceOptions | BubblewrapWorkspaceOptions;

/**
 * What the network needs besides its rules, which come from the policy:
 * who asks about what the rules leave open, where approvals and decisions
 * are kept, and the destinations always allowed or denied (an agent's
 * model API, its CLI's background traffic).
 */
export interface WorkspaceNetworkOptions {
  readonly approve: NetworkApprover;
  readonly ledger?: NetworkLedger;
  readonly alwaysAllow?: readonly string[];
  readonly alwaysDeny?: readonly string[];
  readonly observe?: readonly TrafficObserver[];
  readonly rewrite?: readonly RequestRewriter[];
}

export class Workspace {
  public readonly type: WorkspaceType;
  public readonly root: string;
  /** As created: type, root, image, writable paths. */
  public readonly options: WorkspaceOptions;
  public readonly sandbox: Sandbox;
  /** What of the host's CLI state reaches the sandbox. */
  public readonly hostState: HostState;
  /** Where the homes of the workspaces are kept (see `home()`). */
  public readonly homes: string;
  /** Where the sandbox sees each host path (the root at `paths.agentRoot`). */
  public readonly paths: SandboxPaths;
  /** The programs the agent sees (see `programs`); `undefined`: all of them. */
  public readonly programs: readonly string[] | undefined;
  private network: NetworkBoundary | undefined;

  public constructor(options: WorkspaceOptions) {
    if (options.root.trim().length === 0) {
      throw new UsageError('A raiz do workspace não pode estar vazia.');
    }
    // The root is mounted writable over everything: `/` would hand the agent
    // the whole host (and the host's /dev, where the CLIs' terminals fail).
    if (resolve(options.root) === '/') {
      throw new UsageError(
        'A raiz do workspace não pode ser /: o agente teria escrita no sistema inteiro. Use a pasta do projeto.',
      );
    }

    validatePorts(options.ports ?? []);
    const hostState = options.hostState ?? 'login';
    if (!HOST_STATES.includes(hostState)) {
      throw new UsageError(
        `hostState desconhecido: ${hostState}. Use ${HOST_STATES.join(', ')}.`,
      );
    }
    if (options.programs !== undefined) validateProgramNames(options.programs);
    this.root = options.root;
    this.programs = options.programs;
    this.homes = options.homes ?? getConfig().workspaces.homes;
    this.type = options.type;
    this.options = options;
    this.hostState = hostState;
    this.paths = new SandboxPaths({
      root: options.root,
      home: this.home(),
      hostHome: environment()['HOME'] ?? userHome(),
      ...(options.agentRoot === undefined
        ? {}
        : { agentRoot: options.agentRoot }),
    });
    this.sandbox = createSandbox(options, this.paths);
  }

  /**
   * The home the CLIs run with in this workspace, one per root, kept between
   * runs (sessions survive for `resume`), in `homes`.
   */
  public home(): string {
    const id = createHash('sha256')
      .update(resolve(this.root))
      .digest('hex')
      .slice(0, 16);
    return join(this.homes, id);
  }

  /**
   * Which of `names` (the selected `programs` by default) the sandbox finds
   * in `searchPath` (Choliba's `PATH` by default), and where: nothing runs
   * and no agent is asked.
   */
  public checkPrograms(
    names: readonly string[] = this.programs ?? [],
    searchPath: string | undefined = environment()['PATH'],
  ): ProgramCheck {
    return findPrograms(names, searchPath);
  }

  /**
   * The policy, as the sandbox enforces it: its filesystem part always and,
   * with `network`, its network part. The network gets only its own rules
   * (`networkRulesOf`): with none, the policy's `default` decides. A network
   * already set with `configureNetwork` is kept: whoever built it decided;
   * only its `observe` is added there, since reading changes no decision.
   */
  public applyPermissions(
    policy: AgentPolicy,
    network?: WorkspaceNetworkOptions,
  ): void {
    this.sandbox.configureFilesystem(
      compileFilesystemAccess(policy, this.root),
    );
    if (network === undefined) return;
    if (this.network !== undefined) {
      for (const observer of network.observe ?? []) {
        this.network.observe(observer);
      }
      // The agent's own model options: its requests, not a decision.
      for (const rewriter of network.rewrite ?? []) {
        this.network.rewrite(rewriter);
      }
      return;
    }

    this.configureNetwork(
      new NetworkBoundary({ rules: networkRulesOf(policy), ...network }),
    );
  }

  /** Network only through `boundary`: the sandbox gets none of its own. */
  public configureNetwork(boundary: NetworkBoundary): void {
    if (this.sandbox.isolateNetwork === undefined) {
      throw new UsageError(
        `O workspace ${this.type} não aplica a categoria network: tire essas regras do agente.`,
      );
    }

    boundary.publish(this.options.ports ?? []);
    this.sandbox.isolateNetwork(boundary);
    this.network = boundary;
  }

  /** See {@link Sandbox.useHost}; sandboxes without it get the whole host share. */
  public useHost(host: SandboxHost): void {
    this.sandbox.useHost?.(host);
  }

  /** See {@link Sandbox.protect}. */
  public protect(paths: readonly string[]): void {
    this.sandbox.protect(paths);
  }

  /**
   * Runs `command` in the root, created if missing: a spawn in a missing
   * `cwd` fails as if the program itself were missing (`ENOENT … docker`).
   */
  public prepare(
    command: ProgramCommand,
  ): ProgramCommand | Promise<ProgramCommand> {
    ensureDirectory(this.root);
    return this.sandbox.prepare({
      ...command,
      cwd: this.root,
    });
  }

  public async close(): Promise<void> {
    await this.sandbox.close?.();
    await this.network?.close();
  }
}

function createSandbox(
  options: WorkspaceOptions,
  paths: SandboxPaths,
): Sandbox {
  const { root, writable = [], programs } = options;
  return options.type === 'docker'
    ? new DockerSandbox({
        root,
        writable,
        paths,
        image: options.image ?? DEFAULT_DOCKER_IMAGE,
        ...(programs === undefined ? {} : { programs }),
      })
    : new BubblewrapSandbox({
        root,
        writable,
        paths,
        ...(programs === undefined ? {} : { programs }),
      });
}
