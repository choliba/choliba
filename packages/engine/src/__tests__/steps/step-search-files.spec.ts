import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentStep } from '@choliba/domain';
import { folderSummary, searchFiles } from '../../steps/step-search-files';
import { makeTmpDir } from '../helpers/tmp';

/** A `search_files` step with these named fields. */
function searchStep(options: Readonly<Record<string, string | readonly string[]>>): AgentStep {
  return { action: 'search_files', args: [], options };
}

describe('folderSummary', () => {
  it('lists the folders up to two levels and counts the files by extension, the most common first', () => {
    expect(
      folderSummary({
        folders: ['src', 'src/app', 'src/app/deep'],
        files: ['a.ts', 'b.ts', 'c.php', 'd.css', 'README'],
      }),
    ).toBe(
      [
        '# pastas (até 2 níveis)',
        'src/',
        'src/app/',
        '',
        '# arquivos por extensão (5 arquivos)',
        '      2 .ts',
        '      1 .css',
        '      1 .php',
      ].join('\n'),
    );
  });

  it('says when max_depth left folders unread', () => {
    expect(
      folderSummary({ folders: ['a'], files: ['x.ts'], cutAt: 1 })
        .split('\n')
        .at(-1),
    ).toBe('(busca limitada a 1 níveis: há pastas mais fundas não lidas)');
  });

  it('shows 200 folders at most, saying how many more there are', () => {
    const folders = Array.from({ length: 203 }, (_, index) => `f${String(index).padStart(3, '0')}`);

    const lines = folderSummary({ folders, files: [] }).split('\n');

    expect(lines.filter((line) => line.startsWith('f'))).toHaveLength(200);
    expect(lines).toContain('(e mais 3 pastas)');
  });
});

describe('searchFiles', () => {
  it('stops max_depth levels down and says so in the summary', () => {
    const tmp = makeTmpDir('search-files-depth');
    try {
      mkdirSync(join(tmp.path, 'app', 'src', 'deep'), { recursive: true });
      writeFileSync(join(tmp.path, 'app', 'src', 'deep', 'a.ts'), '');
      writeFileSync(join(tmp.path, 'app', 'b.php'), '');

      const section = searchFiles(tmp.path, searchStep({ tag: 't', dirs: ['app'], max_depth: '2' }));

      expect(section).toContain('# arquivos por extensão (1 arquivos)\n      1 .php');
      expect(section).toContain('(busca limitada a 2 níveis: há pastas mais fundas não lidas)');
    } finally {
      tmp.cleanup();
    }
  });

  it('puts the summary of each folder in the prompt, between the tag, as untrusted data', () => {
    const tmp = makeTmpDir('search-files');
    try {
      mkdirSync(join(tmp.path, 'app', 'src'), { recursive: true });
      writeFileSync(join(tmp.path, 'app', 'src', 'a.ts'), '');
      writeFileSync(join(tmp.path, 'app', 'b.php'), '');

      const section = searchFiles(tmp.path, searchStep({ tag: 'estrutura', dirs: ['app'], pattern: ['**/*.ts'] }));

      expect(section).toBe(
        [
          '<estrutura>',
          '',
          '<untrusted_input source="search:app">',
          '# pastas (até 2 níveis)\nsrc/\n\n# arquivos por extensão (1 arquivos)\n      1 .ts',
          '</untrusted_input>',
          '',
          '</estrutura>',
        ].join('\n'),
      );
    } finally {
      tmp.cleanup();
    }
  });

  it('saves the whole list to files, and keeps it when the summary is larger than max_size', () => {
    const tmp = makeTmpDir('search-files-limit');
    try {
      writeFileSync(join(tmp.path, 'a.ts'), '');

      expect(() =>
        searchFiles(tmp.path, searchStep({ tag: 'e', dirs: ['.'], files: ['.cache/lista.txt'], max_size: '10' })),
      ).toThrow('e o limite (max_size) é 10 B: 1 arquivo(s) encontrado(s).');
      expect(readFileSync(join(tmp.path, '.cache', 'lista.txt'), 'utf8')).toBe('# .\na.ts\n');
    } finally {
      tmp.cleanup();
    }
  });
});
