import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, readlinkSync, type Dirent } from 'node:fs';
import { join } from 'node:path';

/** sha256 of every file under the definition folders. A folder that is not there counts as empty. */
export function definitionSnapshot(directories: readonly string[]): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const dir of directories) {
    collect(dir, found);
  }
  return found;
}

/**
 * Files created, changed or deleted between two snapshots, each as `criado|alterado|apagado <path>`,
 * sorted by path. A symlink counts as its target text, not the file it points at.
 */
export function definitionChanges(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): readonly string[] {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return paths.flatMap((path) => changeOf(path, before.get(path), after.get(path)));
}

/** What a run prints when definitions changed. Nothing is reverted. */
export function definitionChangeReport(changes: readonly string[]): string {
  const lines = changes.map((change) => `  ${change}`);
  return (
    `A execução alterou definições do choliba, que nenhuma run pode mudar:\n${lines.join('\n')}\n` +
    'Nada foi desfeito.\n'
  );
}

function collect(dir: string, found: Map<string, string>): void {
  let entries: readonly Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    record(join(dir, entry.name), entry, found);
  }
}

function record(path: string, entry: Dirent, found: Map<string, string>): void {
  if (entry.isSymbolicLink()) {
    found.set(path, digest(readlinkSync(path)));
    return;
  }
  if (entry.isDirectory()) {
    collect(path, found);
    return;
  }
  if (!entry.isFile()) {
    return;
  }
  found.set(path, digest(readFileSync(path)));
}

function changeOf(path: string, before: string | undefined, after: string | undefined): readonly string[] {
  if (before === undefined) {
    return [`criado ${path}`];
  }
  if (after === undefined) {
    return [`apagado ${path}`];
  }
  if (before !== after) {
    return [`alterado ${path}`];
  }
  return [];
}

function digest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}
