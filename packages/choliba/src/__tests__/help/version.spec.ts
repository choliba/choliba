import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { cholibaManifest, versionLine } from '../../help/version';

function withDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'choliba-version-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeManifest(dir: string, manifest: Readonly<Record<string, unknown>>): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));
}

describe('cholibaManifest', () => {
  it('reads the package.json of choliba up from the running script, with the commit the build wrote', () => {
    withDir((dir) => {
      writeManifest(dir, { name: 'choliba', version: '0.0.1-dev.44', gitHead: 'bbb4cdb2917b5fd1' });
      const script = path.join(dir, 'bin', 'choliba.js');
      fs.mkdirSync(path.dirname(script));
      fs.writeFileSync(script, '');

      expect(cholibaManifest('/', ['bun', script])).toEqual({ version: '0.0.1-dev.44', gitHead: 'bbb4cdb2917b5fd1' });
    });
  });

  it("skips another package's package.json and falls back to where the source is", () => {
    withDir((dir) => {
      writeManifest(path.join(dir, 'jest'), { name: 'jest', version: '30.0.0' });
      writeManifest(path.join(dir, 'choliba'), { name: 'choliba', version: '0.0.1-dev' });
      const runner = path.join(dir, 'jest', 'bin', 'jest.js');
      fs.mkdirSync(path.dirname(runner));
      fs.writeFileSync(runner, '');

      expect(cholibaManifest(path.join(dir, 'choliba', 'src'), ['node', runner])).toEqual({ version: '0.0.1-dev' });
    });
  });

  it('finds nothing when no package.json up the way is choliba', () => {
    withDir((dir) => {
      expect(cholibaManifest(dir, [])).toBeUndefined();
    });
  });

  it('is the package of these sources when run from them', () => {
    expect(cholibaManifest()?.version).toMatch(/^0\.0\.1-dev/);
  });
});

describe('versionLine', () => {
  it('prints the SemVer version, with the short commit as build metadata when the build wrote one', () => {
    expect(versionLine({ version: '0.0.1-dev.44', gitHead: 'bbb4cdb2917b5fd1' })).toBe(
      'choliba 0.0.1-dev.44+bbb4cdb\n',
    );
    expect(versionLine({ version: '0.0.1-dev' })).toBe('choliba 0.0.1-dev\n');
    expect(versionLine(undefined)).toBe('choliba (versão desconhecida)\n');
  });
});
