import type { ContainerMount } from '../mounts/interfaces/container-mounts.interface';

/**
 * Host directories the process needs in order to run, read-only, the way the image supplies them in Docker.
 * Anything else of this machine stays out unless a mount names it.
 */
const SYSTEM_READ_ONLY: readonly string[] = [
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/lib32',
  '/lib64',
  '/libx32',
  '/etc',
  '/opt',
  '/sys',
];

function readOnlySystem(): readonly string[] {
  return SYSTEM_READ_ONLY.flatMap((path) => ['--ro-bind-try', path, path]);
}

/** One mount as `bwrap` takes it. A hidden file is an empty `/dev/null`; a hidden folder is an empty `tmpfs`. */
function mountArgs(mount: ContainerMount): readonly string[] {
  if (mount.access === 'hidden' && mount.directory) return ['--tmpfs', mount.path];
  if (mount.access === 'hidden') return ['--dev-bind', '/dev/null', mount.path];
  const flag = mount.access === 'read' ? '--ro-bind' : '--bind';
  return [flag, mount.path, mount.path];
}

export interface BwrapCommand {
  readonly bwrap: string;
  readonly home: string;
  readonly programReadOnly: readonly string[];
  readonly mounts: readonly ContainerMount[];
  readonly cwd: string;
  readonly command: readonly string[];
}

function programMounts(paths: readonly string[]): readonly string[] {
  return paths.flatMap((path) => ['--ro-bind', path, path]);
}

/**
 * `bwrap` for one session: the system read-only, then only the mounts, with `cwd` as the working directory.
 * The host network stays: this command isolates paths.
 */
export function bwrapCommand(input: BwrapCommand): readonly string[] {
  return [
    input.bwrap,
    '--die-with-parent',
    ...readOnlySystem(),
    '--proc',
    '/proc',
    '--dev',
    '/dev',
    '--tmpfs',
    '/tmp',
    '--tmpfs',
    '/run',
    '--tmpfs',
    input.home,
    '--setenv',
    'HOME',
    input.home,
    ...programMounts(input.programReadOnly),
    ...input.mounts.flatMap(mountArgs),
    '--chdir',
    input.cwd,
    '--',
    ...input.command,
  ];
}
