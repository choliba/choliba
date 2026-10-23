import { statSync } from 'node:fs';

import { pathGlobs as domainPathGlobs } from '@choliba/domain';

export {
  EVERY_COMMAND,
  NO_PERMISSIONS,
  absolutePermissions,
  allowedCommands,
  blocksEveryCommand,
  canRead,
  formatPermissions,
  mapPermissions,
  outsideExecuteDirs,
  permissionTexts,
  readAgentPermissions,
} from '@choliba/domain';
export type { AgentPermissions, ExecuteRule, RunPlace, ToolRule } from '@choliba/domain';

/** Whether `path` is a folder on disk; a file, or a path that does not exist, is not. */
export function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function pathGlobs(path: string, folder: (path: string) => boolean = isFolder): readonly string[] {
  return domainPathGlobs(path, folder);
}
