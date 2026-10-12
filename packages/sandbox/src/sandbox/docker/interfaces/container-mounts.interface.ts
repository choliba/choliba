import type { ReadDir } from '../../../common';

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

/** What the container mounts, and the paths the run reaches that it leaves to the image. */
export interface ContainerPlan {
  readonly mounts: readonly ContainerMount[];
  /** Paths the agent may reach that are the image's own folders (`isImagePath`): not mounted, the image's are seen. */
  readonly skipped: readonly string[];
}

/** The disk, as the mounts are planned from it; specs pass a table. */
export interface DiskFacts {
  readonly exists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly read: ReadDir;
}
