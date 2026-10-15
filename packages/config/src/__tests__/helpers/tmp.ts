import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTmpDir(prefix: string): { readonly path: string; readonly cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), `${prefix}-`));
  return {
    path,
    cleanup: () => {
      rmSync(path, { recursive: true, force: true });
    },
  };
}
