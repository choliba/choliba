/**
 * The `delete` run tool's script, self-contained (the installed choliba is one bundle, so there is no module to
 * import from). A path is removed only when it lies under an allow root, is not one of them and is not
 * under a deny root, unless it is under one of that deny's exceptions (`!x` in `deny.delete`). Only the
 * folder holding it is resolved: a symlink is checked and removed as itself, never the file it points to.
 */
export function deleteScript(
  allowRoots: readonly string[],
  denyRoots: readonly string[],
  exceptRoots: readonly string[] = [],
): string {
  return `#!/usr/bin/env bun
import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

const allowRoots = ${JSON.stringify(allowRoots)};
const denyRoots = ${JSON.stringify(denyRoots)};
const exceptRoots = ${JSON.stringify(exceptRoots)};

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
  const excepted = exceptRoots.map(realRoot).some((root) => under(root, target));
  if (!excepted && denyRoots.map(realRoot).some((root) => under(root, target))) {
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
