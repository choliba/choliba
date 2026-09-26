import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeTmpDir } from './tmp';

export function makeTmpGitRepo(options?: { readonly dirty?: boolean }): {
  readonly path: string;
  readonly cleanup: () => void;
} {
  const tmp = makeTmpDir('git-repo');
  const cwd = tmp.path;
  execSync('git init -b develop', { cwd });
  execSync('git config user.email "test@example.com"', { cwd });
  execSync('git config user.name "Test"', { cwd });
  writeFileSync(join(cwd, 'README.md'), '# initial\n');
  execSync('git add -A', { cwd });
  execSync('git commit -m "chore: init"', { cwd });
  if (options?.dirty) {
    writeFileSync(join(cwd, 'untracked.txt'), 'pending\n');
  }
  return tmp;
}
