import { execSync } from 'node:child_process';
import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  definitionChangeReport,
  definitionChanges,
  definitionSnapshot,
} from '../../../agents/agents/runs/definition-snapshot';
import { makeTmpDir } from '../../helpers/tmp';

describe('definitionSnapshot', () => {
  it('hashes files and symlink targets, and skips a missing folder and anything that is not a file', () => {
    const tmp = makeTmpDir('def-snapshot');
    try {
      const nested = join(tmp.path, 'agents', 'echo');
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(nested, 'agent.yaml'), 'version: 1\n');
      symlinkSync('agent.yaml', join(nested, 'link'));
      execSync(`mkfifo ${join(tmp.path, 'agents', 'pipe')}`);

      const snapshot = definitionSnapshot([join(tmp.path, 'agents'), join(tmp.path, 'missing')]);

      expect(snapshot.get(join(nested, 'agent.yaml'))).toHaveLength(64);
      expect(snapshot.get(join(nested, 'link'))).toHaveLength(64);
      expect(snapshot.has(join(tmp.path, 'agents', 'pipe'))).toBe(false);
      expect(snapshot.size).toBe(2);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('definitionChanges', () => {
  it('lists a file that was created, changed or deleted, and nothing when the hashes match', () => {
    const tmp = makeTmpDir('def-changes');
    try {
      const file = join(tmp.path, 'skill.md');
      writeFileSync(file, 'one\n');
      const before = definitionSnapshot([tmp.path]);
      expect(definitionChanges(before, definitionSnapshot([tmp.path]))).toEqual([]);

      writeFileSync(file, 'two\n');
      const extra = join(tmp.path, 'extra.md');
      writeFileSync(extra, 'new\n');
      unlinkSync(file);
      expect(definitionChanges(before, definitionSnapshot([tmp.path]))).toEqual([`criado ${extra}`, `apagado ${file}`]);
    } finally {
      tmp.cleanup();
    }
  });

  it('names a file whose bytes changed', () => {
    const before = new Map([['/skills/a.md', 'aaa']]);
    const after = new Map([['/skills/a.md', 'bbb']]);

    expect(definitionChanges(before, after)).toEqual(['alterado /skills/a.md']);
  });
});

describe('definitionChangeReport', () => {
  it('lists the paths and says nothing was reverted', () => {
    const report = definitionChangeReport(['criado /skills/planted.md']);

    expect(report).toContain('A execução alterou definições do choliba, que nenhuma run pode mudar:');
    expect(report).toContain('  criado /skills/planted.md');
    expect(report).toContain('Nada foi desfeito.');
  });
});
