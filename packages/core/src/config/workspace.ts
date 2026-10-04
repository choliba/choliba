import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PACKAGE_FILE } from './files';

/** The package every workspace depends on; its own repository is a workspace too (`workspace:*`). */
export const PACKAGE_NAME = 'choliba';

export class WorkspaceNotFoundError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether `dir/package.json` lists choliba in `dependencies` or `devDependencies`; false when unreadable. */
function dependsOnPackage(dir: string): boolean {
  const file = join(dir, PACKAGE_FILE);
  if (!existsSync(file)) {
    return false;
  }
  try {
    const pkg: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return (
      isRecord(pkg) &&
      ['dependencies', 'devDependencies'].some((key) => {
        const deps = pkg[key];
        return isRecord(deps) && PACKAGE_NAME in deps;
      })
    );
  } catch {
    return false;
  }
}

/**
 * The workspace a command runs in: the nearest folder, from `start` up, whose package.json depends on
 * choliba (`bun add choliba` makes one). Its `.env`, `.choliba/agents/`, `.choliba/skills/` and
 * `.choliba/mcps/` are what the CLIs use, so running from any subfolder of it works the same.
 */
export function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (dependsOnPackage(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new WorkspaceNotFoundError(
        `Nenhuma pasta de trabalho do ${PACKAGE_NAME} acima de ${resolve(start)}: rode dentro de uma pasta cujo ` +
          `package.json dependa de ${PACKAGE_NAME} (crie uma com \`bun add ${PACKAGE_NAME}\`).`,
      );
    }
    dir = parent;
  }
}
