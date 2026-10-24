import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatListing, loadListing, parseListing, saveListing } from '../../steps/step-listing';
import { makeTmpDir } from '../helpers/tmp';

const LISTINGS = [
  { dir: '/app', files: ['Makefile', 'src/a.php'] },
  { dir: 'docs', files: ['guia.md'] },
];

describe('formatListing / parseListing', () => {
  it('writes each folder as a # line with its files under it, and reads it back', () => {
    const text = formatListing(LISTINGS);

    expect(text).toBe('# /app\nMakefile\nsrc/a.php\n# docs\nguia.md\n');
    expect(parseListing(text)).toEqual(LISTINGS);
  });

  it('takes a path before any folder line as relative to the workspace, and skips blank lines', () => {
    expect(parseListing('a.md\n\n# x\nb.md\n')).toEqual([
      { dir: '.', files: ['a.md'] },
      { dir: 'x', files: ['b.md'] },
    ]);
  });
});

describe('saveListing / loadListing', () => {
  it('saves the listing to each file, making its folder, and loads it back', () => {
    const tmp = makeTmpDir('listing');
    try {
      saveListing(tmp.path, ['.cache/a/lista.txt', join(tmp.path, 'b.txt')], LISTINGS);

      expect(readFileSync(join(tmp.path, 'b.txt'), 'utf8')).toBe(formatListing(LISTINGS));
      expect(loadListing(tmp.path, '.cache/a/lista.txt')).toEqual(LISTINGS);
    } finally {
      tmp.cleanup();
    }
  });

  it('says which list is missing and what writes it', () => {
    expect(() => loadListing('/nowhere', 'lista.txt')).toThrow(
      "a lista lista.txt não existe: um search_files com files: ['lista.txt'] a grava antes",
    );
  });
});
