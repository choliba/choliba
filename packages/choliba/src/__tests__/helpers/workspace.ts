import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** A temporary workspace whose package.json depends on choliba. */
export function makeWorkspace(files: Readonly<Record<string, string>> = {}): {
  readonly path: string;
  readonly cleanup: () => void;
} {
  const path = mkdtempSync(join(tmpdir(), 'choliba-workspace-'));
  writeFileSync(join(path, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  for (const [relative, content] of Object.entries(files)) {
    mkdirSync(dirname(join(path, relative)), { recursive: true });
    writeFileSync(join(path, relative), content);
  }
  return {
    path,
    cleanup: () => {
      rmSync(path, { recursive: true, force: true });
    },
  };
}
