import { dirname } from 'node:path';

import { pathBase, withoutTrailingSlash, type AgentPermissions } from '../agent-permissions';
import type { PermissionPolicy } from '../interfaces/execution.interface';
import { hasGlob, isWithin, resolveDenies, type ReadDir } from '../resolve-denies';

/**
 * One path the container sees, at the same absolute path as on this machine: read-only, writable, or hidden (an
 * empty folder or file over a denied path inside a mounted one).
 */
export interface ContainerMount {
  readonly path: string;
  readonly access: 'read' | 'write' | 'hidden';
  /** Whether the path is a folder; a hidden file is covered by an empty file, a hidden folder by an empty one. */
  readonly directory: boolean;
}

/** What a run lets the agent reach, already absolute (`absolutePermissions`). */
export interface SandboxReach {
  readonly permissions: AgentPermissions;
  readonly policy: PermissionPolicy;
  /** `--add-dir`: read like `allow.read`. */
  readonly addDirs: readonly string[];
  /** Where the provider runs, always writable. */
  readonly runDir: string;
  /** What the session needs to read beyond the permissions: the run tools' scripts, the installed packages. */
  readonly alsoRead: readonly string[];
  /** What the session's commands write beyond the permissions: choliba's own output folders. */
  readonly alsoWrite: readonly string[];
}

/** The disk, as the mounts are planned from it; specs pass a table. */
export interface DiskFacts {
  readonly exists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly read: ReadDir;
}

/** The path a declared one is mounted at: the folder before a glob, or the path without its trailing `/`. */
function mountPoint(path: string): string {
  return hasGlob(path) ? pathBase(path) : withoutTrailingSlash(path);
}

/**
 * What is mounted for a declared path: the path itself when it exists. A writable one that does not exist yet (a new
 * test) can only be reached through the folder it goes in, so the container opens that folder, never one higher, and
 * the provider's rules still narrow it down to the file. Nothing else is mounted for a path that is not on disk.
 */
function onDisk(path: string, access: ContainerMount['access'], disk: DiskFacts): string | undefined {
  if (disk.exists(path)) return path;
  const folder = dirname(path);
  return access === 'write' && disk.exists(folder) ? folder : undefined;
}

function mountsOf(
  paths: readonly string[],
  access: ContainerMount['access'],
  disk: DiskFacts,
): readonly ContainerMount[] {
  return paths.flatMap((declared) => {
    const path = onDisk(mountPoint(declared), access, disk);
    return path === undefined ? [] : [{ path, access, directory: disk.isDirectory(path) }];
  });
}

/** One mount per path, writable winning over read-only, sorted so a folder comes before what is inside it. */
function merged(mounts: readonly ContainerMount[]): readonly ContainerMount[] {
  const byPath = new Map<string, ContainerMount>();
  for (const mount of mounts) {
    if (byPath.get(mount.path)?.access !== 'write') byPath.set(mount.path, mount);
  }
  return sorted([...byPath.values()]);
}

function sorted(mounts: readonly ContainerMount[]): readonly ContainerMount[] {
  return [...mounts].sort((a, b) => a.path.localeCompare(b.path));
}

/** `mounts` with each of `over` in place of the mount at its path, whatever that mount allowed. */
function overridden(mounts: readonly ContainerMount[], over: readonly ContainerMount[]): readonly ContainerMount[] {
  const byPath = new Map(mounts.map((mount) => [mount.path, mount]));
  for (const mount of over) byPath.set(mount.path, mount);
  return sorted([...byPath.values()]);
}

/** The denied paths (exceptions already resolved) that lie inside one of `mounts`. */
function deniedInside(
  denies: readonly string[],
  mounts: readonly ContainerMount[],
  disk: DiskFacts,
): readonly string[] {
  return resolveDenies(denies, disk.read)
    .filter((path) => !hasGlob(path))
    .map(withoutTrailingSlash)
    .filter((path) => disk.exists(path) && mounts.some((mount) => isWithin(mount.path, path)));
}

/**
 * What the container mounts for a run, each path at the same absolute path, so the run folder, the run tools and
 * every path in the prompt stay valid. Reads: `allow.read`, `--add-dir`, the folders commands run in and `alsoRead`.
 * Writes: the run folder, `alsoWrite` and, outside `read-only`, `allow.write`. A `deny.read` inside a mount is hidden;
 * a `deny.write` inside a writable one goes back to read-only. Anything else does not exist in the container.
 */
export function containerMounts(reach: SandboxReach, disk: DiskFacts): readonly ContainerMount[] {
  const { permissions } = reach;
  const writes = reach.policy === 'read-only' ? [] : permissions.allowWrite;
  const opened = merged([
    ...mountsOf(
      [
        ...permissions.allowRead,
        ...reach.addDirs,
        ...permissions.allowExecute.map((rule) => rule.dir),
        ...reach.alsoRead,
      ],
      'read',
      disk,
    ),
    ...mountsOf([...writes, reach.runDir, ...reach.alsoWrite], 'write', disk),
  ]);
  const writable = opened.filter((mount) => mount.access === 'write');
  const as =
    (access: ContainerMount['access']) =>
    (path: string): ContainerMount => ({ path, access, directory: disk.isDirectory(path) });
  // A deny.read wins over a deny.write at the same path: hidden is more than read-only.
  return overridden(opened, [
    ...deniedInside(permissions.denyWrite, writable, disk).map(as('read')),
    ...deniedInside(permissions.denyRead, opened, disk).map(as('hidden')),
  ]);
}
