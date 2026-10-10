import type { ContainerMount } from './container-mounts';

/** Where the session's home is inside the container: an empty folder in memory, nothing of this machine's. */
export const CONTAINER_HOME = '/home/choliba';

/** The user the container runs as, so what it writes in a mounted folder belongs to whoever owns the workspace. */
export interface ContainerUser {
  readonly uid: number;
  readonly gid: number;
}

export interface DockerRun {
  readonly image: string;
  readonly mounts: readonly ContainerMount[];
  /** Where the command starts, a mounted folder (the run folder). */
  readonly cwd: string;
  readonly user: ContainerUser;
  /** The variables the container gets, by name: `docker` reads each value from its own environment. */
  readonly env: readonly string[];
  readonly command: readonly string[];
}

/** A `--mount` value: a field with a comma or a quote goes in quotes, as Docker reads the list as CSV. */
function field(text: string): string {
  return /[",]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function mountArg(mount: ContainerMount): string {
  const target = field(`dst=${mount.path}`);
  if (mount.access === 'hidden') {
    return mount.directory ? `type=tmpfs,${target}` : `type=bind,src=/dev/null,${target},readonly`;
  }
  const source = field(`src=${mount.path}`);
  return mount.access === 'read' ? `type=bind,${source},${target},readonly` : `type=bind,${source},${target}`;
}

/**
 * `docker run` for one session: the mounts and nothing else of this machine, as the workspace's owner, on the host's
 * network (the application and the MCPs at `localhost` answer), with a read-only root, no capabilities and no way to
 * gain privileges. `/tmp` and the home are empty folders in memory. The Docker socket is never mounted.
 */
export function dockerRunArgs(run: DockerRun): readonly string[] {
  return [
    'docker',
    'run',
    '--rm',
    '-i',
    '--init',
    '--network',
    'host',
    '--user',
    `${String(run.user.uid)}:${String(run.user.gid)}`,
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    // The browser needs more shared memory than Docker's 64 MB.
    '--shm-size',
    '1g',
    '--tmpfs',
    '/tmp:exec,mode=1777',
    '--tmpfs',
    `${CONTAINER_HOME}:exec,mode=1777`,
    '--env',
    `HOME=${CONTAINER_HOME}`,
    ...run.env.flatMap((name) => ['--env', name]),
    ...run.mounts.flatMap((mount) => ['--mount', mountArg(mount)]),
    '--workdir',
    run.cwd,
    run.image,
    ...run.command,
  ];
}
