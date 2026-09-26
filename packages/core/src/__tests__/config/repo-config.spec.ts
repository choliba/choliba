import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadRepoConfig, mergeConfig, parseConfigFile } from '../../config/repo-config';
import { makeTmpDir } from '../helpers/tmp';

describe('parseConfigFile', () => {
  it('ignores blank lines and comments', () => {
    expect(parseConfigFile('# comment\n\nFOO=bar\n')).toEqual({ FOO: 'bar' });
  });

  it('strips optional quotes', () => {
    expect(parseConfigFile('A="x y"\nB=\'z\'')).toEqual({ A: 'x y', B: 'z' });
  });

  it('skips lines without an equals sign', () => {
    expect(parseConfigFile('INVALID\nFOO=bar\n')).toEqual({ FOO: 'bar' });
  });
});

describe('mergeConfig', () => {
  it('lets process config override file values', () => {
    expect(mergeConfig({ FOO: 'file' }, { FOO: 'shell' })).toEqual({ FOO: 'shell' });
  });
});

describe('loadRepoConfig', () => {
  it('loads values from .env when not set in process config', () => {
    const tmp = makeTmpDir('repo-config');
    try {
      const configPath = join(tmp.path, '.env');
      const readFile = (path: string): string | undefined => (path === configPath ? 'FOO=cursor\n' : undefined);

      expect(loadRepoConfig(tmp.path, {}, readFile)['FOO']).toBe('cursor');
    } finally {
      tmp.cleanup();
    }
  });

  it('prefers process config over .env for the same key', () => {
    const tmp = makeTmpDir('repo-config-shell');
    try {
      const configPath = join(tmp.path, '.env');
      const readFile = (path: string): string | undefined => (path === configPath ? 'FOO=cursor\n' : undefined);

      expect(loadRepoConfig(tmp.path, { FOO: 'claude' }, readFile)).toEqual({ FOO: 'claude' });
    } finally {
      tmp.cleanup();
    }
  });

  it('returns a copy of process config when .env is missing', () => {
    expect(loadRepoConfig('/missing', { FOO: 'bar' }, () => undefined)).toEqual({ FOO: 'bar' });
  });

  it('reads .env from disk when no custom reader is given', () => {
    const tmp = makeTmpDir('repo-config-disk');
    try {
      writeFileSync(join(tmp.path, '.env'), 'FOO=cursor\n');
      expect(loadRepoConfig(tmp.path, {})['FOO']).toBe('cursor');
    } finally {
      tmp.cleanup();
    }
  });

  it('defaults to process.env and ignores a missing .env on disk', () => {
    const key = 'CHOL_REPO_CONFIG_TEST_KEY';
    const previous = process.env[key];
    process.env[key] = 'from-process';
    try {
      expect(loadRepoConfig('/path/that/does/not/exist')[key]).toBe('from-process');
      expect(loadRepoConfig('/path/that/does/not/exist', { FOO: 'bar' })).toEqual({ FOO: 'bar' });
    } finally {
      process.env[key] = previous;
    }
  });
});
