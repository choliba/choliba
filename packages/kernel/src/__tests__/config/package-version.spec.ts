import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findManifest, versionLine } from '../..';

function withDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-version-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function write(dir: string, content: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), content);
}

describe('findManifest', () => {
  it("finds the named package's manifest up from a start, skipping other packages on the way", () => {
    withDir((dir) => {
      write(dir, JSON.stringify({ name: 'app', version: '1.0.0-dev.3', gitHead: 'abcdef1234' }));
      write(path.join(dir, 'node_modules', 'other'), JSON.stringify({ name: 'other', version: '9.9.9' }));

      expect(findManifest('app', [path.join(dir, 'node_modules', 'other')])).toEqual({
        version: '1.0.0-dev.3',
        gitHead: 'abcdef1234',
      });
    });
  });

  it('tries each start in turn, and is undefined when none leads to it', () => {
    withDir((dir) => {
      write(path.join(dir, 'b'), JSON.stringify({ name: 'app', version: '2.0.0' }));
      write(path.join(dir, 'c'), '"not an object"');
      write(path.join(dir, 'd'), JSON.stringify({ name: 'app', version: 2 }));

      expect(findManifest('app', [path.join(dir, 'a'), path.join(dir, 'b')])).toEqual({ version: '2.0.0' });
      expect(findManifest('app', [path.join(dir, 'c'), path.join(dir, 'd')])).toBeUndefined();
      expect(findManifest('app', [])).toBeUndefined();
    });
  });
});

describe('versionLine', () => {
  it('prints the SemVer version, with the short commit as build metadata when the build wrote one', () => {
    expect(versionLine('choliba', { version: '0.0.1-dev.44', gitHead: 'bbb4cdb2917b5fd1' })).toBe(
      'choliba 0.0.1-dev.44+bbb4cdb',
    );
    expect(versionLine('choliba', { version: '0.0.1-dev' })).toBe('choliba 0.0.1-dev');
    expect(versionLine('pacote', undefined)).toBe('pacote (versão desconhecida)');
  });
});
