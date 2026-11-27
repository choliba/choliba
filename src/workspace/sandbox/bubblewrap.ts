import {
  homeOf,
  isDirectory,
  isSymlink,
  listDirectory,
  pathExists,
  readLink,
  join,
} from '../../filesystem/index';
import {
  canEnterUserNamespace,
  processChildren,
  processCwd,
  processName,
  processNamespace,
} from '../../filesystem/proc';
import { environment, startHelper, type Helper } from '../../execute/process';
import type { ProgramCommand } from '../../execute/types';
import { UsageError } from '../../errors';
import { isDebug } from '../../logger/index';
import { log } from '../../logger/index';
import { logSandbox } from './debug';
import { hostStateDirs } from './host-state';
import type { NetworkExit, Sandbox } from './types';
import type { SandboxHost } from './host-access';
import { wrapCommand } from './wrap-command';
import type { FilesystemAccess, FilesystemMask } from '../../policy/index';
import { protectedMasks } from './protect';
import { SandboxPaths } from './path-map';
import {
  BASE_PROGRAMS,
  JAIL_READY_ATTEMPTS,
  JAIL_READY_POLL_MS,
  SANDBOX_SUPPORT_DIR,
} from '../constants';
import { programDirs, visiblePrograms, type FoundProgram } from './programs';

export interface BubblewrapSandboxOptions {
  readonly root: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly writable?: readonly string[];
  /**
   * Where each host path is seen in the jail (the root at `/home/choliba`);
   * by default, from `root` and the `HOME` of `env`.
   */
  readonly paths?: SandboxPaths;
  /**
   * The programs the agent sees (see `WorkspaceOptions.programs`); without
   * it, every program of the host.
   */
  readonly programs?: readonly string[];
}

/**
 * Keeps the jail up while Choliba lives: it blocks reading a pipe from this
 * process, and when Choliba dies (even by SIGKILL, without `close()`), the pipe
 * closes, `cat` exits and the jail's PID 1 takes everything inside with it.
 */
const JAIL_COMMAND = ['cat'] as const;

/**
 * Jails the host executable: only system dirs, the workspace root and CLI
 * state are visible. The rest of the host (including the parent of `root`)
 * is not mounted. The root is seen at `/home/choliba` (see `SandboxPaths`),
 * the only thing in the jail's `/home`; what it needs from the host's homes
 * is mounted under `/opt/choliba`.
 *
 * The bwrap process lives for the workspace, not for each CLI invocation.
 * Commands enter that jail with nsenter, so the pid in the debug log remains
 * valid while the agent is waiting for an answer.
 */
export class BubblewrapSandbox implements Sandbox {
  private readonly root: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly writable: readonly string[];
  private readonly programs: readonly string[] | undefined;
  private paths: SandboxPaths;
  private keeper: Helper | undefined;
  private jailPid: number | undefined;
  private starting: Promise<number> | undefined;
  private filesystem: FilesystemAccess | undefined;
  private protectedPaths: readonly string[] = [];
  private network: NetworkExit | undefined;
  private host: SandboxHost | undefined;

  public constructor({
    root,
    env = environment(),
    writable = [],
    paths,
    programs,
  }: BubblewrapSandboxOptions) {
    this.root = root;
    this.env = env;
    this.writable = writable;
    this.programs = programs;
    this.paths = paths ?? new SandboxPaths({ root, hostHome: homeOf(env) });
  }

  public configureFilesystem(access: FilesystemAccess): void {
    if (this.keeper !== undefined) {
      throw new UsageError(
        'A política deve ser configurada antes da execução.',
      );
    }

    this.filesystem = access;
  }

  public protect(paths: readonly string[]): void {
    if (this.keeper !== undefined) {
      throw new UsageError(
        'Caminhos protegidos devem ser configurados antes da execução.',
      );
    }

    this.protectedPaths = [...this.protectedPaths, ...paths];
  }

  public useHost(host: SandboxHost): void {
    if (this.keeper !== undefined) {
      throw new UsageError('O host deve ser configurado antes da execução.');
    }

    this.host = host;
    // The CLI's home, wherever the host share put it.
    if (host.home !== undefined) this.paths = this.paths.withHome(host.home);
  }

  public isolateNetwork(exit: NetworkExit): void {
    if (this.keeper !== undefined) {
      throw new UsageError('A rede deve ser configurada antes da execução.');
    }

    this.network = exit;
  }

  public async prepare(command: ProgramCommand): Promise<ProgramCommand> {
    const pid = await this.ensureJail();
    const network = this.network;
    const passed = this.host?.env ?? this.env;
    const inner = this.paths.insideCommand(command, passed['PATH']);

    const prepared = wrapCommand(
      'nsenter',
      bubblewrapNsenterArgs(pid, this.paths.agentRoot, network !== undefined),
      network === undefined
        ? inner
        : wrapCommand('env', network.environment(), inner),
    );
    // nsenter hands its environment to the CLI: only what was let in (all
    // of Choliba's without a host share), with the paths as the jail sees
    // them.
    return { ...prepared, env: this.paths.insideEnv(passed) };
  }

  public async started(pid: number | undefined): Promise<void> {
    if (!isDebug() || this.jailPid === undefined) {
      return;
    }

    log.debug({
      type: 'sandbox',
      sandbox: 'bubblewrap',
      phase: 'command',
      pid,
      childPid: this.jailPid,
      enter: bubblewrapEnterCommand(this.jailPid, this.paths.agentRoot),
    });
  }

  public async close(): Promise<void> {
    const keeper = this.keeper;
    this.keeper = undefined;
    this.jailPid = undefined;

    await keeper?.stop();
  }

  /** Nothing to change without `programs`; with it, see `visiblePrograms`. */
  private programSelection(writable: readonly string[]): ProgramSelection {
    if (this.programs === undefined) return { dirs: [], visible: [] };
    const searchPath = (this.host?.env ?? this.env)['PATH'];
    return {
      dirs: programDirs(searchPath, homeOf(this.env), writable),
      visible: visiblePrograms(this.programs, searchPath, BASE_PROGRAMS),
    };
  }

  private async ensureJail(): Promise<number> {
    if (this.jailPid !== undefined && this.keeper?.pid !== undefined) {
      return this.jailPid;
    }

    // Concurrent executions share one jail instead of each starting its own.
    this.starting ??= this.startJail().finally(() => {
      this.starting = undefined;
    });
    return this.starting;
  }

  private async startJail(): Promise<number> {
    // spawn reports a missing cwd as ENOENT on the executable itself.
    if (!pathExists(this.root)) {
      throw new UsageError(`A raiz do workspace não existe: ${this.root}`);
    }

    const writable = writableBinds(
      this.root,
      [
        ...(this.host?.state ?? hostStateDirs(this.env)),
        ...this.writable,
        ...(this.filesystem?.writable ?? []),
      ],
      this.filesystem?.workspaceAccess !== 'readonly',
    );
    const readonly = [
      ...bubblewrapReadonlyBinds(this.env, writable),
      // The CLI's installation: its versions, never its state.
      ...(this.host?.programs ?? []).filter(
        (path) => pathExists(path) && !coveredBy(path, writable),
      ),
      ...(this.filesystem?.workspaceAccess === 'readonly' ? [this.root] : []),
    ];
    // Before anything starts: a selected program that is missing stops here.
    const programs = this.programSelection(writable);
    const jailArgs = [
      ...bubblewrapJailArgs(
        this.root,
        writable,
        readonly,
        this.network === undefined,
        this.paths,
      ),
      ...bubblewrapProgramArgs(this.paths, programs),
      ...bubblewrapMaskArgs(this.paths, [
        ...(this.filesystem?.masks ?? []),
        // Logins the provider does not use, and the other homes: not in
        // the jail.
        ...(this.host?.hidden ?? []).map((path) => ({
          path,
          access: 'hidden' as const,
        })),
      ]),
      // The workspace's home, after the masks (it may be inside a hidden
      // path), and the CLI's login, read-only, inside it.
      ...homeArgs(this.paths, this.host),
      // Last: a later mount would cover them (the gate's hook lives in the
      // workspace's home).
      ...bubblewrapMaskArgs(this.paths, protectedMasks(this.protectedPaths)),
    ];

    logSandbox(
      'bubblewrap',
      { executable: 'bwrap', arguments: jailArgs },
      {
        isolation: true,
        network:
          this.network === undefined
            ? { unshare: 'all', share: ['net'] }
            : { unshare: 'all', exit: 'proxy' },
        workingDir: this.paths.agentRoot,
        mounts: [
          ...readonly.map((path) => ({
            type: 'bind',
            source: path,
            destination: this.paths.inside(path),
            mode: 'ro',
          })),
          { type: 'dev', destination: '/dev' },
          { type: 'proc', destination: '/proc' },
          { type: 'tmpfs', destination: '/tmp' },
          ...writable.map((path) => ({
            type: 'bind',
            source: path,
            destination: this.paths.inside(path),
            mode: 'rw',
          })),
          ...programs.dirs.map((dir) => ({
            type: 'tmpfs',
            destination: this.paths.inside(dir),
          })),
          ...programs.visible.map(({ path, file }) => ({
            type: 'bind',
            source: file,
            destination: this.paths.inside(path),
            mode: 'ro',
          })),
          ...(this.host?.home === undefined
            ? []
            : [
                {
                  type: 'bind',
                  source: this.host.home,
                  destination: this.paths.inside(this.host.home),
                  mode: 'rw',
                },
                ...this.host.credentials.map(({ source, destination }) => ({
                  type: 'bind',
                  source,
                  destination: this.paths.inside(destination),
                  mode: 'ro',
                })),
              ]),
        ],
        volumes: writable.map(
          (path) => `${path}:${this.paths.inside(path)}:rw`,
        ),
        dieWithParent: true,
      },
    );

    const keeper = startHelper('bwrap', [...jailArgs, ...JAIL_COMMAND], {
      cwd: this.root,
    });
    this.keeper = keeper;

    keeper.onExit(() => {
      if (this.keeper === keeper) {
        this.keeper = undefined;
        this.jailPid = undefined;
      }
    });

    const parentPid = keeper.pid;

    if (parentPid === undefined) {
      await this.close();
      throw new UsageError('Não foi possível iniciar a jaula bubblewrap.');
    }

    const pid = await resolveBubblewrapPid(parentPid, {
      cwd: this.paths.agentRoot,
      command: JAIL_COMMAND[0],
    });

    if (pid === undefined) {
      await this.close();
      throw new UsageError('Não foi possível entrar na jaula bubblewrap.');
    }

    try {
      await this.network?.attach((command) =>
        wrapCommand('nsenter', bubblewrapNetworkArgs(pid), command),
      );
    } catch (error) {
      await this.close();
      throw error;
    }

    this.jailPid = pid;

    if (isDebug()) {
      log.debug({
        type: 'sandbox',
        sandbox: 'bubblewrap',
        phase: 'process',
        pid: parentPid,
        childPid: pid,
        enter: bubblewrapEnterCommand(pid, this.paths.agentRoot),
      });
    }

    return pid;
  }
}

/** The program folders a jail empties, and the programs it shows in them. */
export interface ProgramSelection {
  readonly dirs: readonly string[];
  readonly visible: readonly FoundProgram[];
}

/**
 * The program folders emptied (`--tmpfs`) and each visible program mounted
 * back, read-only, where the `PATH` finds it, from the file it runs (a
 * multicall binary still sees its own name).
 */
export function bubblewrapProgramArgs(
  paths: SandboxPaths,
  { dirs, visible }: ProgramSelection,
): string[] {
  return [
    ...dirs.flatMap((dir) => ['--tmpfs', paths.inside(dir)]),
    ...visible.flatMap(({ path, file }) => [
      '--ro-bind',
      file,
      paths.inside(path),
    ]),
  ];
}

const OPTIONAL_SYSTEM_DIRS = [
  '/nix/store',
  '/snap',
  '/run/systemd/resolve',
] as const;

const ROOT_SYMLINKS: readonly string[] = ['/bin', '/lib', '/lib64', '/sbin'];

export function bubblewrapReadonlyBinds(
  env: NodeJS.ProcessEnv = environment(),
  writable: readonly string[] = [],
): string[] {
  const home = homeOf(env);
  const candidates = [
    '/usr',
    '/etc',
    ...hostOptEntries(),
    ...OPTIONAL_SYSTEM_DIRS,
    join(home, '.local/bin'),
    join(home, '.bun'),
    ...(env['PATH'] ?? '').split(':'),
  ];
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const path of candidates) {
    if (
      path.length === 0 ||
      path === '/' ||
      ROOT_SYMLINKS.includes(path) ||
      seen.has(path) ||
      !pathExists(path) ||
      coveredBy(path, writable) ||
      coveredBy(path, paths)
    ) {
      continue;
    }

    seen.add(path);
    paths.push(path);
  }

  return paths;
}

/**
 * What the host has in `/opt`, one entry at a time: the sandbox's own
 * `/opt/choliba` lives next to them (a host entry with that name is left
 * out).
 */
export function hostOptEntries(): string[] {
  if (!isDirectory('/opt')) return [];
  return listDirectory('/opt')
    .map((name) => join('/opt', name))
    .filter((path) => path !== SANDBOX_SUPPORT_DIR);
}

export function bubblewrapJailArgs(
  root: string,
  writable: readonly string[],
  readonlyBinds: readonly string[] = bubblewrapReadonlyBinds(),
  shareNet = true,
  paths: SandboxPaths = new SandboxPaths({
    root,
    hostHome: homeOf(environment()),
  }),
): string[] {
  return [
    '--die-with-parent',
    '--unshare-all',
    // Without it, the jail has only its own loopback.
    ...(shareNet ? ['--share-net'] : []),
    ...readonlyBinds.flatMap((path) => ['--ro-bind', path, paths.inside(path)]),
    ...rootSymlinkArgs(),
    '--dev',
    '/dev',
    '--proc',
    '/proc',
    '--tmpfs',
    '/tmp',
    ...writable.flatMap((path) => ['--bind', path, paths.inside(path)]),
    '--chdir',
    paths.agentRoot,
  ];
}

function rootSymlinkArgs(): string[] {
  const args: string[] = [];

  for (const path of ROOT_SYMLINKS) {
    const target = readSymlink(path);

    if (target !== undefined) {
      args.push('--symlink', target, path);
    } else if (pathExists(path)) {
      args.push('--ro-bind', path, path);
    }
  }

  return args;
}

function readSymlink(path: string): string | undefined {
  try {
    if (!isSymlink(path)) {
      return undefined;
    }

    return readLink(path);
  } catch {
    return undefined;
  }
}

function coveredBy(path: string, mounts: readonly string[]): boolean {
  return mounts.some((mount) => path === mount || path.startsWith(`${mount}/`));
}

export function bubblewrapNsenterArgs(
  pid: number,
  root: string,
  ownNetwork = false,
): string[] {
  return [
    '--preserve-credentials',
    '-t',
    String(pid),
    '-m',
    '-U',
    '-i',
    '-u',
    '-p',
    // A jail sharing the host's network has none to enter.
    ...(ownNetwork ? ['-n'] : []),
    `--wdns=${root}`,
    '--',
  ];
}

/**
 * Only the jail's network (and its user namespace, which owns it): the
 * program still sees the host's files, e.g. the network bridge reaching
 * Choliba's proxy socket.
 */
export function bubblewrapNetworkArgs(pid: number): string[] {
  return ['--preserve-credentials', '-t', String(pid), '-U', '-n', '--'];
}

/**
 * Interactive attach omits the PID namespace because it steals the TTY. Agent
 * commands enter it through bubblewrapNsenterArgs so /proc/self stays valid.
 */
export function bubblewrapEnterCommand(
  pid: number,
  root: string,
  shell = '/bin/bash',
): string {
  return [
    'nsenter',
    '--preserve-credentials',
    '-t',
    String(pid),
    '-m',
    '-U',
    '-i',
    '-u',
    `--wdns=${root}`,
    '--',
    'env',
    `'PS1=(jaula) \\w \\$ '`,
    shell,
    '--norc',
    '-i',
  ].join(' ');
}

/**
 * Inner bwrap process whose user namespace is the jail. The outer `bwrap`
 * stays in the host user namespace; nsenter -U on that pid cannot work.
 */
/**
 * Inner bwrap process of the jail. With `ready`, also waits until the jail is
 * set up: the process sits in `cwd` and already runs `command`. Entering it
 * earlier makes nsenter fail with "cannot open current working directory".
 */
export async function resolveBubblewrapPid(
  parentPid: number,
  ready?: { readonly cwd: string; readonly command: string },
): Promise<number | undefined> {
  const hostUser = processNamespace(parentPid, 'user');

  for (let attempt = 0; attempt < JAIL_READY_ATTEMPTS; attempt += 1) {
    for (const pid of processChildren(parentPid)) {
      const user = processNamespace(pid, 'user');

      if (
        user !== undefined &&
        user !== hostUser &&
        canEnterUserNamespace(pid) &&
        (ready === undefined || isJailReady(pid, ready))
      ) {
        return pid;
      }
    }

    await delay(JAIL_READY_POLL_MS);
  }

  return undefined;
}

function isJailReady(
  pid: number,
  ready: { readonly cwd: string; readonly command: string },
): boolean {
  return (
    processCwd(pid) === ready.cwd &&
    processChildren(pid).some((child) => processName(child) === ready.command)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function writableBinds(
  root: string,
  extra: readonly string[],
  writableRoot = true,
): string[] {
  const paths = writableRoot ? [root] : [];
  const seen = new Set(paths);

  for (const path of extra) {
    if (seen.has(path) || !pathExists(path)) {
      continue;
    }

    seen.add(path);
    paths.push(path);
  }

  return paths;
}

function homeArgs(
  paths: SandboxPaths,
  host: SandboxHost | undefined,
): string[] {
  if (host?.home === undefined) return [];
  return [
    '--bind',
    host.home,
    paths.inside(host.home),
    ...host.credentials.flatMap(({ source, destination }) => [
      '--ro-bind',
      source,
      paths.inside(destination),
    ]),
  ];
}

function bubblewrapMaskArgs(
  paths: SandboxPaths,
  masks: readonly FilesystemMask[],
): string[] {
  return masks.flatMap(({ path, access }) => {
    const destination = paths.inside(path);
    if (access === 'readonly') return ['--ro-bind', path, destination];
    return isDirectory(path)
      ? ['--tmpfs', destination]
      : ['--ro-bind', '/dev/null', destination];
  });
}
