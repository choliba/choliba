import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { existingResourceStarts, findResource, locateResource, resourceStarts } from '../../config/index';

function withTree(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'resources-'));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('resourceStarts', () => {
  it('starts from the running script, link resolved, then the source dir; only the source dir without a script', () => {
    withTree((root) => {
      mkdirSync(join(root, 'bin'));
      writeFileSync(join(root, 'bin', 'choliba.js'), '');
      symlinkSync(join(root, 'bin', 'choliba.js'), join(root, 'choliba'));

      expect(resourceStarts('/src', ['bun', join(root, 'choliba')])).toEqual([join(root, 'bin'), '/src']);
      expect(resourceStarts('/src', ['bun'])).toEqual(['/src']);
      expect(resourceStarts(root).at(-1)).toBe(root);
    });
  });
});

describe('existingResourceStarts', () => {
  it('drops a source dir that is not on this machine and keeps both when they are, in order', () => {
    withTree((root) => {
      const bin = join(root, 'bin');
      mkdirSync(bin);
      writeFileSync(join(bin, 'choliba.js'), '');
      const argv = ['bun', join(bin, 'choliba.js')];
      const missing = join(root, 'built-on-ci');

      expect(existingResourceStarts(missing, argv)).toEqual([bin]);
      mkdirSync(missing);
      expect(existingResourceStarts(missing, argv)).toEqual([bin, missing]);
    });
  });
});

describe('locateResource / findResource', () => {
  it('prefers the package of the running script, reached through its link, over the source dir', () => {
    withTree((root) => {
      const installed = join(root, 'node_modules', 'choliba');
      mkdirSync(join(installed, 'bin'), { recursive: true });
      mkdirSync(join(installed, 'templates', 'ticket'), { recursive: true });
      writeFileSync(join(installed, 'bin', 'choliba.js'), '');
      mkdirSync(join(root, 'node_modules', '.bin'));
      symlinkSync(join(installed, 'bin', 'choliba.js'), join(root, 'node_modules', '.bin', 'choliba'));
      const source = join(root, 'src', 'pkg', 'src');
      mkdirSync(join(root, 'src', 'pkg', 'templates', 'ticket'), { recursive: true });
      mkdirSync(source);

      const argv = ['bun', join(root, 'node_modules', '.bin', 'choliba')];
      expect(locateResource('templates/ticket', source, argv)).toBe(join(installed, 'templates', 'ticket'));
      expect(locateResource('templates/ticket', source, ['bun'])).toBe(join(root, 'src', 'pkg', 'templates', 'ticket'));
      expect(locateResource('templates/ticket', source, ['bun', join(root, 'missing.js')])).toBe(
        join(root, 'src', 'pkg', 'templates', 'ticket'),
      );
    });
  });

  it('looks in the directory the bundle loaded when the script and the source do not have it', () => {
    withTree((root) => {
      const shipped = join(root, 'dist');
      const source = join(root, 'frozen-source');
      mkdirSync(join(shipped, 'schemes'), { recursive: true });
      mkdirSync(source);
      const holder = globalThis as { __CHOLIBA_SHIPPED_DIR__?: string };
      try {
        holder.__CHOLIBA_SHIPPED_DIR__ = '';
        expect(locateResource('schemes', source, ['bun'])).toBeUndefined();
        holder.__CHOLIBA_SHIPPED_DIR__ = source;
        expect(locateResource('schemes', source, ['bun'])).toBeUndefined();
        expect(resourceStarts(source, ['bun'])).toEqual([source]);
        expect(existingResourceStarts(source, ['bun'])).toEqual([source]);
        holder.__CHOLIBA_SHIPPED_DIR__ = shipped;
        expect(locateResource('schemes', source, ['bun'])).toBe(join(shipped, 'schemes'));
        expect(findResource('schemes', source, ['bun'])).toBe(join(shipped, 'schemes'));
        expect(resourceStarts(source, ['bun'])).toEqual([source]);
      } finally {
        delete holder.__CHOLIBA_SHIPPED_DIR__;
      }
    });
  });

  it('gives undefined when found nowhere, and findResource the path next to the source dir', () => {
    withTree((root) => {
      expect(locateResource('nope/here', root, ['bun'])).toBeUndefined();
      mkdirSync(join(root, 'only-here'));
      expect(locateResource('only-here', join(root, 'src'))).toBe(join(root, 'only-here'));
      expect(findResource('nope/here', join(root, 'src'), ['bun'])).toBe(join(root, 'nope', 'here'));
      mkdirSync(join(root, 'schemes'));
      expect(findResource('schemes', join(root, 'src'), ['bun'])).toBe(join(root, 'schemes'));
    });
  });
});
