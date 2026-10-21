import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { commandOnPath } from '../../platform/index';

describe('commandOnPath', () => {
  it('finds the executable in the first directory of the PATH that has it, and nothing when none has', () => {
    const root = mkdtempSync(join(tmpdir(), 'command-on-path-'));
    try {
      for (const dir of ['a', 'b']) mkdirSync(join(root, dir));
      writeFileSync(join(root, 'a', 'tool'), '');
      writeFileSync(join(root, 'b', 'tool'), '');
      chmodSync(join(root, 'b', 'tool'), 0o755);
      const path = ['', join(root, 'a'), join(root, 'b')].join(delimiter);

      // `a/tool` is not executable: the first that runs wins.
      expect(commandOnPath('tool', path)).toBe(join(root, 'b', 'tool'));
      expect(commandOnPath('missing', path)).toBeUndefined();
      expect(commandOnPath('tool', '')).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reads the process's PATH when given none", () => {
    const before = process.env['PATH'];
    delete process.env['PATH'];
    try {
      expect(commandOnPath('nada-com-este-nome')).toBeUndefined();
    } finally {
      process.env['PATH'] = before;
    }
  });
});
