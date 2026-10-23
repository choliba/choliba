import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { PlannedFile } from '../ports';

export function askExchangeDir(runDir: string): string {
  return join(runDir, '.choliba-ask');
}

/** Writes the files required by a run and returns an idempotent cleanup. */
export function applyRunFiles(files: readonly PlannedFile[]): () => void {
  const made = [...new Set(files.map((file) => dirname(file.path)))].filter((folder) => !existsSync(folder));
  made.forEach((folder) => mkdirSync(folder, { recursive: true }));
  files.forEach((file) => {
    writeFileSync(file.path, file.content, 'utf8');
    chmodSync(file.path, 0o755);
  });
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    files.forEach((file) => {
      rmSync(file.path, { force: true });
    });
    made.forEach((folder) => {
      rmSync(folder, { recursive: true, force: true });
    });
  };
}
