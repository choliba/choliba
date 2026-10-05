import { chmodSync, existsSync, rmSync, writeFileSync } from 'node:fs';

import type { PlannedFile } from '../providers/interfaces/provider.interface';
import { deleteBridgePath } from './delete-bridge-path';

export { deleteBridgePath } from './delete-bridge-path';

/**
 * The helper's source, self-contained (the installed choliba is one bundle, so there is no module to
 * import from). A path is removed only when it lies under an allow root, is not one of them and is not
 * under a deny root. Only the folder holding it is resolved: a symlink is checked and removed as itself,
 * never the file it points to.
 */
function bridgeSource(allowRoots: readonly string[], denyRoots: readonly string[]): string {
  return `#!/usr/bin/env bun
import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

const allowRoots = ${JSON.stringify(allowRoots)};
const denyRoots = ${JSON.stringify(denyRoots)};

function realRoot(root) {
  const base = root.length > 1 ? root.replace(/\\/+$/, '') : root;
  return existsSync(base) ? realpathSync(base) : resolve(base);
}

function under(root, path) {
  return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);
}

function removeUnder(path) {
  const absolute = resolve(path);
  try {
    lstatSync(absolute);
  } catch {
    throw new Error('Não encontrado: ' + absolute);
  }
  const target = join(realpathSync(dirname(absolute)), basename(absolute));
  const allows = allowRoots.map(realRoot);
  if (!allows.some((root) => under(root, target))) {
    throw new Error('Fora dos diretórios permitidos: ' + absolute);
  }
  if (allows.includes(target)) {
    throw new Error('Recusado apagar a raiz permitida: ' + absolute);
  }
  if (denyRoots.map(realRoot).some((root) => under(root, target))) {
    throw new Error('Apagar negado neste caminho: ' + absolute);
  }
  rmSync(target, { recursive: true });
  return target;
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('uso: ' + process.argv[1] + ' <path…>');
  process.exit(1);
}
for (const path of paths) {
  try {
    console.log(removeUnder(path));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
`;
}

/** What `applyDeleteBridge` would write next to `runDir`, writing nothing. */
export function planDeleteBridge(
  runDir: string,
  allowRoots: readonly string[],
  denyRoots: readonly string[],
): PlannedFile {
  return { path: deleteBridgePath(runDir), content: bridgeSource(allowRoots, denyRoots) };
}

/**
 * Writes the ephemeral delete helper next to `runDir` (roots baked in) and returns the restore that
 * removes it. No-op restore when there is nothing to allow.
 */
export function applyDeleteBridge(
  runDir: string,
  allowRoots: readonly string[],
  denyRoots: readonly string[] = [],
): () => void {
  if (allowRoots.length === 0) {
    return () => undefined;
  }
  const plan = planDeleteBridge(runDir, allowRoots, denyRoots);
  writeFileSync(plan.path, plan.content, 'utf8');
  chmodSync(plan.path, 0o755);
  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    rmSync(plan.path, { force: true });
  };
}

/** Whether a run should materialize the delete bridge for these permissions and policy. */
export function shouldApplyDeleteBridge(allowDelete: readonly string[], policy: string): boolean {
  return allowDelete.length > 0 && policy !== 'read-only';
}

export function bridgeExists(runDir: string): boolean {
  return existsSync(deleteBridgePath(runDir));
}
