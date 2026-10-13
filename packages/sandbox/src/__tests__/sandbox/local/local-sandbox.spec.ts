import { chmodSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';

import { bwrapOnPath, LocalSandbox, SandboxEnforcementError, type DiskFacts, type SandboxReach } from '../../../index';
import { makeTmpDir } from '../../helpers/tmp';

const DISK: DiskFacts = {
  exists: () => true,
  isDirectory: () => true,
  read: () => [],
};

const REACH: SandboxReach = {
  permissions: { allowRead: ['/w/docs/'], allowWrite: [], allowExecute: [], denyRead: [], denyWrite: [] },
  policy: 'edits',
  addDirs: [],
  runDir: '/w/.cache/runs/1',
  alsoRead: [],
  alsoWrite: [],
};

describe('bwrapOnPath', () => {
  it('returns the first executable bwrap, and nothing when the path has none', () => {
    const saved = process.env['PATH'];
    delete process.env['PATH'];
    try {
      expect(bwrapOnPath()).toBeUndefined();
    } finally {
      process.env['PATH'] = saved;
    }
    expect(bwrapOnPath('')).toBeUndefined();
    const tmp = makeTmpDir('bwrap-path');
    try {
      const missing = join(tmp.path, 'missing');
      const plain = join(tmp.path, 'bwrap');
      writeFileSync(plain, '');
      expect(bwrapOnPath(`${delimiter}${missing}${delimiter}${tmp.path}`)).toBeUndefined();
      chmodSync(plain, 0o755);
      expect(bwrapOnPath(`${delimiter}${tmp.path}`)).toBe(plain);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('LocalSandbox', () => {
  it('refuses the command when bwrap is not installed, and says how to install it', () => {
    const missing = new LocalSandbox({ disk: DISK, bwrap: undefined });
    expect(() => missing.plan({ command: ['claude', '-p'], reach: REACH })).toThrow(SandboxEnforcementError);
    expect(() => missing.plan({ command: ['claude', '-p'], reach: REACH })).toThrow('sudo apt install bubblewrap');
  });

  it('leaves the command as it is while bwrap is present and paths are not imposed yet', () => {
    const plan = new LocalSandbox({ disk: DISK, bwrap: '/usr/bin/bwrap' }).plan({
      command: ['claude', '-p'],
      reach: REACH,
    });
    expect(plan).toEqual({ command: ['claude', '-p'], place: { kind: 'local' }, paths: [], skipped: [] });
  });
});
