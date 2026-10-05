import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { addFiles, formatFilesSection, readGlobs } from '../../steps/add-files';
import { makeTmpDir } from '../helpers/tmp';

describe('readGlobs', () => {
  it('reads each matched file once, sorted, skipping directories', () => {
    const tmp = makeTmpDir('add-files-read');
    try {
      mkdirSync(join(tmp.path, 'docs', 'sub.md'), { recursive: true });
      writeFileSync(join(tmp.path, 'docs', 'b.md'), 'B');
      writeFileSync(join(tmp.path, 'docs', 'a.md'), 'A');

      expect(readGlobs(tmp.path, ['docs/**/*.md', 'docs/a.md'])).toEqual([
        { path: 'docs/a.md', content: 'A' },
        { path: 'docs/b.md', content: 'B' },
      ]);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('formatFilesSection', () => {
  it('wraps the files in the tag, each under its path', () => {
    expect(formatFilesSection('docs', ['*.md'], [{ path: 'a.md', content: 'A' }])).toBe(
      '<docs>\n\n### a.md\n\nA\n\n</docs>',
    );
  });

  it('says so when nothing matched', () => {
    expect(formatFilesSection('docs', ['docs/**/*.md', 'x.md'], [])).toBe(
      '<docs>\n(nenhum arquivo encontrado: docs/**/*.md x.md)\n</docs>',
    );
  });
});

describe('addFiles', () => {
  it('reads and formats in one call', () => {
    const tmp = makeTmpDir('add-files');
    try {
      writeFileSync(join(tmp.path, 'README.md'), '# Hi');

      expect(addFiles(tmp.path, 'readme_atual', ['README.md'])).toBe(
        '<readme_atual>\n\n### README.md\n\n# Hi\n\n</readme_atual>',
      );
    } finally {
      tmp.cleanup();
    }
  });
});
