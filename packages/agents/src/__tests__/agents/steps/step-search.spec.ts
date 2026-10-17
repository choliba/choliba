import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_IGNORE, searchFolder } from '../../../agents/steps/step-search';
import { makeTmpDir } from '../../helpers/tmp';

describe('searchFolder', () => {
  it('lists every folder and the files the pattern matches, sorted, skipping the ignored folders', () => {
    const tmp = makeTmpDir('search-folder');
    try {
      for (const dir of ['src/app', 'node_modules/x', 'assets', 'src/assets']) {
        mkdirSync(join(tmp.path, dir), { recursive: true });
      }
      for (const file of [
        'package.json',
        'src/b.ts',
        'src/app/a.ts',
        'node_modules/x/i.js',
        'assets/l.js',
        'src/assets/m.js',
      ]) {
        writeFileSync(join(tmp.path, file), '');
      }

      expect(searchFolder(tmp.path, '.', { ignore: ['assets'] })).toEqual({
        files: ['package.json', 'src/app/a.ts', 'src/b.ts'],
        folders: ['src', 'src/app'],
      });
      expect(searchFolder(tmp.path, 'src', { pattern: ['**/*.ts'] }).files).toEqual(['app/a.ts', 'b.ts']);
      expect(DEFAULT_IGNORE).toContain('node_modules');
    } finally {
      tmp.cleanup();
    }
  });

  it('reads pattern and ignore as path patterns: whole names, not parts of one, and files as well as folders', () => {
    const tmp = makeTmpDir('search-folder-patterns');
    try {
      for (const dir of ['bd', 'bdados', 'src/lib', 'public']) {
        mkdirSync(join(tmp.path, dir), { recursive: true });
      }
      for (const file of ['bd/a.sql', 'bdados/b.php', 'src/lib/c.php', 'public/d.php', 'logo.png', 'composer.json']) {
        writeFileSync(join(tmp.path, file), '');
      }

      expect(searchFolder(tmp.path, '.', { ignore: ['bd', 'lib/', '*.png'] })).toEqual({
        files: ['bdados/b.php', 'composer.json', 'public/d.php'],
        folders: ['bdados', 'public', 'src'],
      });
      expect(searchFolder(tmp.path, '.', { pattern: ['*.php', '!public/**'] }).files).toEqual([
        'bdados/b.php',
        'src/lib/c.php',
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it('passes over a folder it cannot read, does not follow links, and finds nothing in a missing folder', () => {
    const tmp = makeTmpDir('search-folder-odd');
    const locked = join(tmp.path, 'locked');
    try {
      mkdirSync(join(locked, 'in'), { recursive: true });
      writeFileSync(join(tmp.path, 'a.txt'), '');
      symlinkSync(tmp.path, join(tmp.path, 'loop'));
      chmodSync(locked, 0o000);

      expect(searchFolder(tmp.path, '.', {})).toEqual({ files: ['a.txt'], folders: ['locked'] });
      expect(searchFolder(tmp.path, 'missing', {})).toEqual({ files: [], folders: [] });
    } finally {
      chmodSync(locked, 0o755);
      tmp.cleanup();
    }
  });

  it('goes down max_depth levels at most, listing the folders it did not read and saying where it stopped', () => {
    const tmp = makeTmpDir('search-folder-depth');
    try {
      mkdirSync(join(tmp.path, 'a/b/c'), { recursive: true });
      for (const file of ['top.php', 'a/one.php', 'a/b/two.php', 'a/b/c/three.php']) {
        writeFileSync(join(tmp.path, file), '');
      }

      expect(searchFolder(tmp.path, '.', { maxDepth: 2 })).toEqual({
        files: ['a/one.php', 'top.php'],
        folders: ['a', 'a/b'],
        cutAt: 2,
      });
      expect(searchFolder(tmp.path, '.', { maxDepth: 4 })).not.toHaveProperty('cutAt');
      expect(searchFolder(tmp.path, '.', {}).files).toHaveLength(4);
    } finally {
      tmp.cleanup();
    }
  });
});
