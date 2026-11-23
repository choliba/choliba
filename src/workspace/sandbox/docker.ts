import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';

import { isDirectory, pathExists } from '../../filesystem/index';
import { currentUser, environment, runProgram } from '../../execute/process';
import type { ProgramCommand } from '../../execute/types';
import { UsageError } from '../../errors';
import { isDebug } from '../../logger/index';
import { log } from '../../logger/index';
import { logSandbox } from './debug';
import { hostStateDirs } from './host-state';
import { protectedMasks } from './protect';
import type { NetworkExit, Sandbox } from './types';
import type { SandboxHost } from './host-access';
import { bubblewrapReadonlyBinds, hostOptEntries } from './bubblewrap';
import { SandboxPaths } from './path-map';
import { wrapCommand } from './wrap-command';
import type { FilesystemAccess } from '../../policy/index';
import {
  DEFAULT_DOCKER_IMAGE,
  HOST_HOMES,
  SANDBOX_SUPPORT_DIR,
} from '../constants';

export interface DockerSandboxOptions {
  /**
   * `FROM nome:tag` comes from the registry (Docker Hub) when missing here;
   * `nome:tag` alone is an image built on this machine, never pulled.
   */
  readonly image: string;
  readonly root: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly writable?: readonly string[];
  /**
   * Where each host path is seen in the container (the root at
   * `/home/choliba`); by default, from `root` and the `HOME` of `env`.
   */
  readonly paths?: SandboxPaths;
}

export { DEFAULT_DOCKER_IMAGE } from '../constants';

const HOST_ROOT = '/host';
const FROM_IMAGE = /^FROM\s+(\S+)$/i;
const LOCAL_IMAGE = /^\S+$/;

interface DockerImage {
  readonly name: string;
  /** `docker run --pull`: from the registry, or only what is here. */
  readonly pull: 'missing' | 'never';
}

/**
 * Jails the host executable inside the image: the host filesystem is read-only,
 * except for the workspace root and generic CLI state directories. The host's
 * `/home` is an empty tmpfs: the root is seen at `/home/choliba` and what the
 * agent needs from the homes (tools, the CLI's home, Choliba's cache) under
 * `/opt/choliba` (see `SandboxPaths`).
 */
export class DockerSandbox implements Sandbox {
  private readonly image: DockerImage;
  private readonly root: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly writable: readonly string[];
  private paths: SandboxPaths;
  private containerName: string | undefined;
  private filesystem: FilesystemAccess | undefined;
  private protectedPaths: readonly string[] = [];
  private network: NetworkExit | undefined;
  private host: SandboxHost | undefined;

  public constructor({
    image,
    root,
    env = environment(),
    writable = [],
    paths,
  }: DockerSandboxOptions) {
    this.image = readDockerImage(image);
    this.root = root;
    this.env = env;
    this.writable = writable;
    this.paths = paths ?? new SandboxPaths({ root, hostHome: homeOf(env) });
  }

  public configureFilesystem(access: FilesystemAccess): void {
    this.filesystem = access;
  }

  public protect(paths: readonly string[]): void {
    this.protectedPaths = [...this.protectedPaths, ...paths];
  }

  /**
   * The container gets no network (`--network none`): each one starts with
   * the bridge to Choliba's proxy, which then runs the command.
   */
  public useHost(host: SandboxHost): void {
    this.host = host;
    // The CLI's home, wherever the host share put it.
    if (host.home !== undefined) this.paths = this.paths.withHome(host.home);
  }

  public isolateNetwork(exit: NetworkExit): void {
    this.network = exit;
  }

  public async prepare(command: ProgramCommand): Promise<ProgramCommand> {
    const network = this.network;
    const launcher = network === undefined ? [] : await network.launcher();
    const host = this.host;
    // With a host share, only its variables reach the container; the docker
    // client keeps its own (DOCKER_HOST…) without passing them in.
    const passed = host?.env ?? this.env;
    const paths = this.paths;
    const envNames = Object.keys(passed)
      .filter((name) => passed[name] !== undefined)
      .toSorted();
    // A variable with a host path in it (HOME, PATH) goes with the value the
    // container sees; the others, by name, from the docker client's own.
    const translated = paths.insideEnv(passed);
    const envArgs = envNames.flatMap((name) =>
      translated[name] === passed[name]
        ? ['-e', name]
        : ['-e', `${name}=${translated[name] ?? ''}`],
    );
    const agentRoot = paths.agentRoot;
    const innerRoot = `${HOST_ROOT}${agentRoot}`;
    const writable = [
      ...(host?.state ?? hostStateDirs(this.env)),
      ...this.writable,
      ...(this.filesystem?.writable ?? []),
      // The bridge finds the proxy's socket there and creates the
      // published ports' sockets.
      ...(network === undefined ? [] : [network.sandboxDir()]),
    ];
    const described = describeMounts(
      paths,
      this.root,
      writable,
      {
        workspaceAccess: this.filesystem?.workspaceAccess ?? 'readwrite',
        writable: this.filesystem?.writable ?? [],
        masks: [
          ...(this.filesystem?.masks ?? []),
          ...protectedMasks(this.protectedPaths),
          // Logins the provider does not use: not in the container.
          ...(host?.hidden ?? []).map((path) => ({
            path,
            access: 'hidden' as const,
          })),
        ],
      },
      bubblewrapReadonlyBinds(this.env),
    );
    // The CLI's installation, read-only; the workspace's home, writable, with
    // the CLI's login read-only inside it. Docker mounts the shorter paths
    // first, so the home is there even inside a hidden path.
    const mounts = [
      ...described,
      ...(host?.programs ?? [])
        // Inside the CLI's state (`share`): already there, writable.
        .filter(
          (path) =>
            pathExists(path) &&
            !writable.some(
              (mount) => path === mount || path.startsWith(`${mount}/`),
            ),
        )
        .map((path) => ({
          type: 'bind',
          source: path,
          destination: `${HOST_ROOT}${paths.inside(path)}`,
          mode: 'ro',
        })),
      ...(host?.home === undefined
        ? []
        : [
            {
              type: 'bind',
              source: host.home,
              destination: `${HOST_ROOT}${paths.inside(host.home)}`,
              mode: 'rw',
            },
            ...host.credentials.map(({ source, destination }) => ({
              type: 'bind',
              source,
              destination: `${HOST_ROOT}${paths.inside(destination)}`,
              mode: 'ro',
            })),
          ]),
    ];
    const containerName = `choliba-${randomUUID().slice(0, 8)}`;
    this.containerName = containerName;
    const { uid, gid } = currentUser();

    logSandbox('docker', command, {
      isolation: true,
      image: this.image.name,
      pull: this.image.pull,
      container: { name: containerName, autoRemove: true, interactive: true },
      network: { mode: network === undefined ? 'host' : 'none' },
      workingDir: innerRoot,
      mounts,
      volumes: mounts
        .filter((mount) => mount.type === 'bind')
        .map(
          (mount) =>
            `${mount.source}:${mount.destination}:${mount.mode ?? 'rw'}`,
        ),
      capabilities: ['SYS_CHROOT'],
      user: { uid, gid },
      env: envNames,
      chroot: HOST_ROOT,
      chdir: agentRoot,
    });

    const prepared = wrapCommand(
      'docker',
      [
        'run',
        '--rm',
        '-i',
        '--name',
        containerName,
        '--network',
        network === undefined ? 'host' : 'none',
        '--cap-add',
        'SYS_CHROOT',
        ...volumeArgs(mounts),
        '-w',
        innerRoot,
        ...envArgs,
        '--pull',
        this.image.pull,
        this.image.name,
        'chroot',
        HOST_ROOT,
        ...innerUserCommand(),
        '/usr/bin/env',
        `--chdir=${agentRoot}`,
        ...(network?.environment() ?? []),
        ...launcher.map((argument) => paths.insideValue(argument)),
      ],
      paths.insideCommand(command, passed['PATH']),
    );
    // The docker client gets only what goes in, plus its own settings.
    return host === undefined
      ? prepared
      : { ...prepared, env: { ...dockerClientEnv(this.env), ...host.env } };
  }

  /** Removes the last container; killing `docker run` does not always stop it. */
  public async close(): Promise<void> {
    const name = this.containerName;
    this.containerName = undefined;

    if (name === undefined) {
      return;
    }

    await runProgram('docker', ['rm', '--force', name], {
      timeoutMs: 10_000,
    }).catch(() => undefined);
  }

  public async started(pid: number | undefined): Promise<void> {
    if (!isDebug()) {
      return;
    }

    log.debug({
      type: 'sandbox',
      sandbox: 'docker',
      phase: 'process',
      pid,
      container: { name: this.containerName },
    });

    if (this.containerName === undefined) {
      return;
    }

    const inspect = await inspectContainer(this.containerName);

    log.debug({
      type: 'sandbox',
      sandbox: 'docker',
      phase: 'inspect',
      container: { name: this.containerName },
      ...(inspect ?? { error: 'container não encontrado' }),
    });
  }
}

interface Mount {
  readonly type: string;
  readonly source?: string;
  readonly destination: string;
  readonly mode?: string;
  /** tmpfs options (e.g. `mode=755`). */
  readonly options?: string;
}

function describeMounts(
  paths: SandboxPaths,
  root: string,
  extra: readonly string[],
  filesystem: FilesystemAccess,
  /** The tools; those under the hidden `/home` and `/opt` come back. */
  tools: readonly string[],
): Mount[] {
  const at = (path: string): string => `${HOST_ROOT}${paths.inside(path)}`;
  const mounts: Mount[] = [
    { type: 'bind', source: '/', destination: HOST_ROOT, mode: 'ro' },
    ...hiddenHomes(paths, tools),
    {
      type: 'bind',
      source: root,
      destination: at(root),
      mode: filesystem.workspaceAccess === 'readonly' ? 'ro' : 'rw',
    },
  ];
  const seen = new Set([root]);

  for (const path of extra) {
    if (seen.has(path) || !pathExists(path)) {
      continue;
    }

    seen.add(path);
    mounts.push({
      type: 'bind',
      source: path,
      destination: at(path),
      mode: 'rw',
    });
  }

  mounts.push({ type: 'tmpfs', destination: `${HOST_ROOT}/tmp` });

  for (const mask of filesystem.masks) {
    const destination = at(mask.path);

    if (mask.access === 'readonly') {
      mounts.push({
        type: 'bind',
        source: mask.path,
        destination,
        mode: 'ro',
      });
    } else if (isDirectory(mask.path)) {
      mounts.push({ type: 'tmpfs', destination });
    } else {
      mounts.push({
        type: 'bind',
        source: '/dev/null',
        destination,
        mode: 'ro',
      });
    }
  }
  return mounts;
}

/**
 * The host's `/home` as an empty tmpfs (no other homes, no ~/.config, no
 * browser profiles, no logins), and `/opt` as one too, with the host's
 * entries mounted back next to `/opt/choliba`, where the tools the agent runs
 * from the homes (bun, ~/.local/bin, PATH entries there) come back read-only.
 * Both are tmpfs because the host's `/` is read-only: Docker cannot create
 * the mount points there.
 */
function hiddenHomes(paths: SandboxPaths, tools: readonly string[]): Mount[] {
  if (!isDirectory('/opt')) {
    throw new UsageError(
      `O workspace Docker precisa da pasta /opt no host: é onde ${SANDBOX_SUPPORT_DIR} é montado. Crie-a (sudo mkdir /opt).`,
    );
  }
  const opt = new Set(hostOptEntries());
  return [
    // Traversable: the paths mounted back inside are reached through them.
    {
      type: 'tmpfs',
      destination: `${HOST_ROOT}${HOST_HOMES}`,
      options: 'mode=755',
    },
    { type: 'tmpfs', destination: `${HOST_ROOT}/opt`, options: 'mode=755' },
    ...tools
      .filter((path) => opt.has(path) || paths.moves(path))
      .map((path) => ({
        type: 'bind',
        source: path,
        destination: `${HOST_ROOT}${paths.inside(path)}`,
        mode: 'ro',
      })),
  ];
}

/** What the docker client itself reads (DOCKER_HOST…): never passed in. */
function dockerClientEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const client: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && name.startsWith('DOCKER_')) client[name] = value;
  }
  return client;
}

function homeOf(env: NodeJS.ProcessEnv): string {
  return env['HOME'] ?? homedir();
}

function volumeArgs(mounts: readonly Mount[]): string[] {
  const args: string[] = [];

  for (const mount of mounts) {
    if (mount.type === 'tmpfs') {
      args.push(
        '--tmpfs',
        mount.options === undefined
          ? mount.destination
          : `${mount.destination}:${mount.options}`,
      );
      continue;
    }

    if (mount.source === undefined) {
      continue;
    }

    const spec =
      mount.mode === 'ro'
        ? `${mount.source}:${mount.destination}:ro`
        : `${mount.source}:${mount.destination}`;
    args.push('-v', spec);
  }

  return args;
}

function innerUserCommand(): readonly string[] {
  const { uid, gid } = currentUser();

  if (uid === undefined || gid === undefined || uid === 0) {
    return [];
  }

  return [
    '/usr/bin/setpriv',
    `--reuid=${uid}`,
    `--regid=${gid}`,
    '--init-groups',
    '--',
  ];
}

function readDockerImage(image: string): DockerImage {
  const value = image.trim();
  const remote = FROM_IMAGE.exec(value)?.[1];
  if (remote !== undefined) return { name: remote, pull: 'missing' };
  // `FROM` without a name is a mistake, not an image called FROM.
  if (LOCAL_IMAGE.test(value) && !/^FROM$/i.test(value)) {
    return { name: value, pull: 'never' };
  }

  throw new UsageError(
    `A imagem do workspace Docker deve ser FROM <imagem> (do Docker Hub) ou <imagem> (construída nesta máquina). Exemplo:\n\n  ${DEFAULT_DOCKER_IMAGE}`,
  );
}

async function inspectContainer(
  name: string,
): Promise<Record<string, unknown> | undefined> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const stdout = await runProgram('docker', ['inspect', name], {
        timeoutMs: 1000,
      });
      const parsed: unknown = JSON.parse(stdout);

      if (Array.isArray(parsed)) {
        return readInspect(parsed[0]);
      }
    } catch {
      await delay(60);
    }
  }

  return undefined;
}

function readInspect(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const state = isRecord(value['State']) ? value['State'] : {};
  const host = isRecord(value['HostConfig']) ? value['HostConfig'] : {};
  const config = isRecord(value['Config']) ? value['Config'] : {};
  const net = isRecord(value['NetworkSettings'])
    ? value['NetworkSettings']
    : {};
  const networks = isRecord(net['Networks']) ? net['Networks'] : {};

  return {
    id: value['Id'],
    name: value['Name'],
    created: value['Created'],
    image: value['Image'],
    platform: value['Platform'],
    driver: value['Driver'],
    path: value['Path'],
    args: value['Args'],
    state: {
      status: state['Status'],
      running: state['Running'],
      pid: state['Pid'],
      error: state['Error'],
      startedAt: state['StartedAt'],
    },
    config: {
      hostname: config['Hostname'],
      user: config['User'],
      image: config['Image'],
      workingDir: config['WorkingDir'],
    },
    host: {
      networkMode: host['NetworkMode'],
      binds: host['Binds'],
      capAdd: host['CapAdd'],
      privileged: host['Privileged'],
      autoRemove: host['AutoRemove'],
      tmpfs: host['Tmpfs'],
      runtime: host['Runtime'],
      pidMode: host['PidMode'],
      ipcMode: host['IpcMode'],
    },
    mounts: Array.isArray(value['Mounts'])
      ? value['Mounts'].map(readMount)
      : [],
    network: {
      mode: host['NetworkMode'],
      sandboxId: net['SandboxID'],
      ipAddress: net['IPAddress'],
      gateway: net['Gateway'],
      macAddress: net['MacAddress'],
      networks: Object.fromEntries(
        Object.entries(networks).map(([networkName, network]) => [
          networkName,
          isRecord(network)
            ? {
                networkId: network['NetworkID'],
                ipAddress: network['IPAddress'],
                gateway: network['Gateway'],
                macAddress: network['MacAddress'],
              }
            : {},
        ]),
      ),
    },
  };
}

function readMount(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  return {
    type: value['Type'],
    name: value['Name'],
    source: value['Source'],
    destination: value['Destination'],
    driver: value['Driver'],
    mode: value['Mode'],
    rw: value['RW'],
    propagation: value['Propagation'],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
