import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyRunFiles, askExchangeDir } from '../../runs/run-files';

describe('run files', () => {
  it('writes executable files, removes folders it made, and cleans only once', () => {
    const root = mkdtempSync(join(tmpdir(), 'engine-run-files-'));
    const folder = join(root, 'tools');
    const file = join(folder, 'ask');
    try {
      const restore = applyRunFiles([{ path: file, content: '#!/bin/sh\n' }]);
      expect(readFileSync(file, 'utf8')).toBe('#!/bin/sh\n');
      expect(statSync(file).mode & 0o777).toBe(0o755);
      restore();
      restore();
      expect(existsSync(folder)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps a folder that already existed', () => {
    const root = mkdtempSync(join(tmpdir(), 'engine-run-files-'));
    const folder = join(root, 'tools');
    mkdirSync(folder);
    const restore = applyRunFiles([{ path: join(folder, 'ask'), content: 'ask' }]);
    restore();
    expect(existsSync(folder)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it('places the ask exchange inside the run folder', () => {
    expect(askExchangeDir('/runs/1')).toBe(join('/runs/1', '.choliba-ask'));
  });
});
