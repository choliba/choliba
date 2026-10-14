import { dirname } from 'node:path';

import { complementOf, hasGlob, isWithin, pathBase, resolveDenies, withoutTrailingSlash } from '../../common';
import type { SandboxReach } from '../interfaces/sandbox-backend.interface';
import type { ContainerMount, ContainerPlan, DiskFacts } from './interfaces/container-mounts.interface';

/** Where a container's home is: an empty folder, nothing of this machine's. The image keeps it; it is never mounted. */
export const CONTAINER_HOME = '/home/choliba';

/**
 * The folders of the image's own system: programs, libraries, configuration, the browsers and the session's home.
 * The container keeps them as the image has them; nothing of this machine is mounted over them.
 */
export const IMAGE_FOLDERS: readonly string[] = [
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/lib32',
  '/lib64',
  '/libx32',
  '/ms-playwright',
  '/opt',
  '/proc',
  '/root',
  '/run',
  '/sbin',
  '/sys',
  '/usr',
  CONTAINER_HOME,
];

/** Whether `path` is the root, which holds every image folder, or one of them, or inside one. */
export function isImagePath(path: string): boolean {
  return path === '/' || IMAGE_FOLDERS.some((folder) => isWithin(folder, path));
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

/** The folders among `mounts`, and the files. */
function byKind(mounts: readonly ContainerMount[]): {
  readonly folders: readonly ContainerMount[];
  readonly files: readonly ContainerMount[];
} {
  return {
    folders: mounts.filter((mount) => mount.directory),
    files: mounts.filter((mount) => !mount.directory),
  };
}

/** What a writable file opens: its folder, unless a writable folder already holds it. */
function folderOf(file: ContainerMount, folders: readonly ContainerMount[]): readonly ContainerMount[] {
  if (folders.some((folder) => isWithin(folder.path, file.path))) return [];
  return [{ path: dirname(file.path), access: 'write', directory: true }];
}

/**
 * The writable mounts as the container takes them, and what goes back to read-only. A file mounted on its own cannot
 * be replaced (a rename over it fails) nor have a file written beside it (the folder is read-only), and that is how a
 * provider saves a file: a temporary file next to it, renamed over it. So a writable file opens its folder, and what
 * in that folder does not lead to a writable path goes back to read-only (`complementOf`).
 */
function writableMounts(
  writes: readonly ContainerMount[],
  disk: DiskFacts,
): { readonly mounts: readonly ContainerMount[]; readonly readOnly: readonly string[] } {
  const { folders, files } = byKind(writes);
  const opened = merged(files.flatMap((file) => folderOf(file, folders)));
  const writable = [...folders, ...files].map((mount) => mount.path);
  const readOnly = opened.flatMap((folder) =>
    complementOf(
      writable.filter((path) => isWithin(folder.path, path)),
      disk.read,
      folder.path,
    ).map(withoutTrailingSlash),
  );
  return { mounts: [...folders, ...opened], readOnly };
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
 * Writes: the run folder, `alsoWrite` and, outside `read-only`, `allow.write`; a writable file opens its folder, the
 * folder's other entries read-only (`writableMounts`). A `deny.read` inside a mount is hidden;
 * a `deny.write` inside a writable one goes back to read-only. Anything else does not exist in the container, and the
 * image's own folders (`isImagePath`) are never mounted: the agent sees the image's, and they are `skipped`.
 */
export function containerMounts(reach: SandboxReach, disk: DiskFacts): ContainerPlan {
  const planned = plannedMounts(reach, disk);
  const skipped = planned.filter((mount) => isImagePath(mount.path) && mount.access !== 'hidden');
  return {
    mounts: planned.filter((mount) => !isImagePath(mount.path)),
    skipped: skipped.map((mount) => mount.path),
  };
}

/** Every mount the reach asks for, the image's folders included. */
function plannedMounts(reach: SandboxReach, disk: DiskFacts): readonly ContainerMount[] {
  const { permissions } = reach;
  const writes = reach.policy === 'read-only' ? [] : permissions.allowWrite;
  const written = writableMounts(mountsOf([...writes, reach.runDir, ...reach.alsoWrite], 'write', disk), disk);
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
    ...written.mounts,
  ]);
  const writable = opened.filter((mount) => mount.access === 'write');
  const as =
    (access: ContainerMount['access']) =>
    (path: string): ContainerMount => ({ path, access, directory: disk.isDirectory(path) });
  // A deny.read wins over a deny.write at the same path: hidden is more than read-only.
  return overridden(opened, [
    ...written.readOnly.map(as('read')),
    ...deniedInside(permissions.denyWrite, writable, disk).map(as('read')),
    ...deniedInside(permissions.denyRead, opened, disk).map(as('hidden')),
  ]);
}
