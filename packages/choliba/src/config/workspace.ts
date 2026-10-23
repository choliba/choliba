import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { ExpectedError } from '@choliba/kernel';

import { PACKAGE_FILE } from '@choliba/workspace';

const PACKAGE_NAME = 'choliba';

export class WorkspaceNotFoundError extends ExpectedError {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dependsOnCholiba(dir: string): boolean {
  const file = join(dir, PACKAGE_FILE);
  if (!existsSync(file)) return false;
  try {
    const pkg: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return (
      isRecord(pkg) &&
      ['dependencies', 'devDependencies'].some((key) => {
        const dependencies = pkg[key];
        return isRecord(dependencies) && PACKAGE_NAME in dependencies;
      })
    );
  } catch {
    return false;
  }
}

/** The nearest parent whose package.json depends on choliba. */
export function findWorkspaceRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (dependsOnCholiba(dir)) return dir;
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
