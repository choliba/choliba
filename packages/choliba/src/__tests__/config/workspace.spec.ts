import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { findWorkspaceRoot, WorkspaceNotFoundError } from '../../config';
import { makeWorkspace } from '../helpers/workspace';

describe('findWorkspaceRoot', () => {
  it('finds a workspace from a child and ignores a malformed nearer package', () => {
    const workspace = makeWorkspace();
    const child = join(workspace.path, 'packages', 'broken');
    mkdirSync(child, { recursive: true });
    writeFileSync(join(child, 'package.json'), '{');
    try {
      expect(findWorkspaceRoot(child)).toBe(workspace.path);
    } finally {
      workspace.cleanup();
    }
  });

  it('fails with guidance outside a workspace', () => {
    expect(() => findWorkspaceRoot('/')).toThrow(WorkspaceNotFoundError);
    expect(() => findWorkspaceRoot('/')).toThrow('crie uma com `bun add choliba`');
  });
});
