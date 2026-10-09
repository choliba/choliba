import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DirEntry, ReadDir } from '../../common/resolve-denies';
import {
  complementOf,
  denyExceptions,
  exceptionPath,
  isException,
  isWithin,
  readDir,
  resolveDenies,
  strayExceptions,
} from '../../common/resolve-denies';
import { makeTmpDir } from '../helpers/tmp';

const dir = (name: string): DirEntry => ({ name, isDirectory: true });
const file = (name: string): DirEntry => ({ name, isDirectory: false });

/** A workspace like dev-tools: `.choliba/` with skills and agents, the app code and a secret beside them. */
const DISK: Readonly<Record<string, readonly DirEntry[]>> = {
  '/': [dir('etc'), dir('w')],
  '/w': [dir('.choliba'), dir('packages'), file('.env')],
  '/w/.choliba': [dir('agents'), dir('skills'), file('config.yaml')],
  '/w/.choliba/skills': [dir('react-vite'), dir('other')],
};

const fakeDisk: ReadDir = (path) => DISK[path] ?? [];

describe('exceptions', () => {
  it('tells an exception by its !, and gives its path without it', () => {
    expect(isException('!/w/x')).toBe(true);
    expect(isException('/w/x')).toBe(false);
    expect(exceptionPath('!/w/x')).toBe('/w/x');
    expect(denyExceptions(['/w/', '!/w/x/', '!/'])).toEqual(['/w/x', '/']);
  });

  it('knows a path within a folder, and everything within /', () => {
    expect(isWithin('/w', '/w')).toBe(true);
    expect(isWithin('/w', '/w/a')).toBe(true);
    expect(isWithin('/w', '/wx')).toBe(false);
    expect(isWithin('/', '/anything')).toBe(true);
  });
});

describe('complementOf', () => {
  it('lists, in each folder from / down to a kept path, every entry that leads to none', () => {
    expect(complementOf(['/w/.choliba/skills/react-vite'], fakeDisk)).toEqual([
      '/etc/',
      '/w/.choliba/agents/',
      '/w/.choliba/config.yaml',
      '/w/.choliba/skills/other/',
      '/w/.env',
      '/w/packages/',
    ]);
  });

  it('starts at the root it is given', () => {
    expect(complementOf(['/w/.choliba'], fakeDisk, '/w')).toEqual(['/w/.env', '/w/packages/']);
  });

  it('keeps everything under a kept folder, even another kept path inside it', () => {
    expect(complementOf(['/w', '/w/.choliba'], fakeDisk)).toEqual(['/etc/']);
  });
});

describe('resolveDenies', () => {
  it('keeps a list without exceptions as it is', () => {
    expect(resolveDenies(['/w/', '/etc/passwd'], fakeDisk)).toEqual(['/w/', '/etc/passwd']);
  });

  it('turns a deny holding an exception into everything inside it but the way to the exception', () => {
    expect(resolveDenies(['/w', '!/w/.choliba/skills/react-vite/', '/etc/'], fakeDisk)).toEqual([
      '/w/.choliba/agents/',
      '/w/.choliba/config.yaml',
      '/w/.choliba/skills/other/',
      '/w/.env',
      '/w/packages/',
      '/etc/',
    ]);
  });

  it('carves a deny written with a trailing / too, and never a glob or the deny itself', () => {
    expect(resolveDenies(['/w/', '!/w/.choliba'], fakeDisk)).toEqual(['/w/.env', '/w/packages/']);
    expect(resolveDenies(['/w/*', '!/w/.choliba'], fakeDisk)).toEqual(['/w/*']);
    expect(resolveDenies(['/w/', '!/w'], fakeDisk)).toEqual(['/w/']);
  });

  it('reads the real disk by default', () => {
    const tmp = makeTmpDir('resolve-denies');
    try {
      mkdirSync(join(tmp.path, 'keep'));
      writeFileSync(join(tmp.path, 'secret'), 'x');

      expect(resolveDenies([tmp.path, `!${join(tmp.path, 'keep')}`])).toEqual([join(tmp.path, 'secret')]);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('strayExceptions', () => {
  it('names the exceptions that lie under no deny of the list', () => {
    expect(strayExceptions(['/w/', '!/w/.choliba', '!/etc/x', '/a/*', '!/a/b', '!/w'])).toEqual([
      '/etc/x',
      '/a/b',
      '/w',
    ]);
    expect(strayExceptions(['/w/', '!/w/.choliba'])).toEqual([]);
  });
});

describe('readDir', () => {
  it('reads a real folder, telling folders from files, and nothing from one that does not exist', () => {
    const tmp = makeTmpDir('resolve-denies-readdir');
    try {
      mkdirSync(join(tmp.path, 'sub'));
      writeFileSync(join(tmp.path, 'a.txt'), 'a');

      expect([...readDir(tmp.path)].sort((a, b) => a.name.localeCompare(b.name))).toEqual([file('a.txt'), dir('sub')]);
      expect(readDir(join(tmp.path, 'nope'))).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });
});
