import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { collectDocsSnapshot } from '../../git/docs-snapshot';
import { makeTmpDir } from '../helpers/tmp';

describe('collectDocsSnapshot', () => {
  it('reads README.md at the repo root and markdown files under docs/', () => {
    const tmp = makeTmpDir('docs-snapshot');
    try {
      writeFileSync(join(tmp.path, 'README.md'), '# Root\n');
      mkdirSync(join(tmp.path, 'docs', 'nested'), { recursive: true });
      writeFileSync(join(tmp.path, 'docs', '01-intro.md'), '# Intro\n');
      writeFileSync(join(tmp.path, 'docs', 'nested', '02-detail.md'), '# Detail\n');
      writeFileSync(join(tmp.path, 'docs', 'ignore.txt'), 'skip');

      expect(collectDocsSnapshot(tmp.path)).toEqual({
        readme: '# Root\n',
        docs: [
          { path: '01-intro.md', content: '# Intro\n' },
          { path: join('nested', '02-detail.md'), content: '# Detail\n' },
        ],
      });
    } finally {
      tmp.cleanup();
    }
  });

  it('returns null readme and empty docs when directories are missing', () => {
    const tmp = makeTmpDir('docs-snapshot-empty');
    try {
      expect(collectDocsSnapshot(tmp.path)).toEqual({ readme: null, docs: [] });
    } finally {
      tmp.cleanup();
    }
  });
});
