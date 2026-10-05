import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeTmpDir } from './tmp';

/** A temp workspace (its package.json depends on choliba) with `files` written relative to its root. */
export function makeWorkspace(files: Readonly<Record<string, string>> = {}): {
  readonly path: string;
  readonly cleanup: () => void;
} {
  const tmp = makeTmpDir('workspace');
  writeFileSync(join(tmp.path, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  for (const [relative, content] of Object.entries(files)) {
    mkdirSync(dirname(join(tmp.path, relative)), { recursive: true });
    writeFileSync(join(tmp.path, relative), content);
  }
  return tmp;
}
