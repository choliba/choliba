import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findWorkspaceRoot, WorkspaceNotFoundError } from '../../config/index';

function withTree(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'workspace-root-'));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('findWorkspaceRoot', () => {
  it('finds the nearest folder whose package.json depends on choliba, from any subfolder', () => {
    withTree((root) => {
      const workspace = join(root, 'goiaba');
      mkdirSync(join(workspace, 'agents', 'po'), { recursive: true });
      writeFileSync(join(workspace, 'package.json'), JSON.stringify({ dependencies: { choliba: '^1.0.0' } }));
      const devOnly = join(root, 'dev');
      mkdirSync(devOnly);
      writeFileSync(join(devOnly, 'package.json'), JSON.stringify({ devDependencies: { choliba: 'workspace:*' } }));

      expect(findWorkspaceRoot(workspace)).toBe(workspace);
      expect(findWorkspaceRoot(join(workspace, 'agents', 'po'))).toBe(workspace);
      expect(findWorkspaceRoot(devOnly)).toBe(devOnly);
    });
  });

  it('skips package.json files that do not depend on choliba or cannot be read', () => {
    withTree((root) => {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '1' } }));
      const other = join(root, 'other');
      mkdirSync(join(other, 'broken'), { recursive: true });
      writeFileSync(join(other, 'package.json'), JSON.stringify({ dependencies: { left: '1' }, devDependencies: [] }));
      writeFileSync(join(other, 'broken', 'package.json'), '{ nope');
      const list = join(other, 'list');
      mkdirSync(list);
      writeFileSync(join(list, 'package.json'), '[]');

      expect(findWorkspaceRoot(join(other, 'broken'))).toBe(root);
      expect(findWorkspaceRoot(list)).toBe(root);
    });
  });

  it('fails outside any workspace, saying how to create one', () => {
    withTree((root) => {
      expect(() => findWorkspaceRoot(root)).toThrow(WorkspaceNotFoundError);
      expect(() => findWorkspaceRoot(root)).toThrow('crie uma com `bun add choliba`');
    });
  });
});
