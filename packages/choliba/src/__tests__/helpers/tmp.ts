import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A fresh temp directory per call, for specs (loader, plan-store) that need real files on
 * disk. Jest runs on Node, so `node:fs` is safe here — unlike anything that would touch `Bun`.
 */
export function makeTmpDir(prefix: string): { readonly path: string; readonly cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), `${prefix}-`));
  return {
    path,
    cleanup: () => {
      rmSync(path, { recursive: true, force: true });
    },
  };
}
