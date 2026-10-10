import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { WorkspaceNotFoundError } from '../../config';
import { ConfigService } from '../../config';
import { makeTmpDir } from '../helpers/tmp';
import { makeWorkspace } from '../helpers/workspace';

function configFor(cwd: string, env: Readonly<Record<string, string>> = {}): ConfigService {
  return new ConfigService(cwd, env);
}

describe('ConfigService', () => {
  it('finds the workspace from a subfolder of where the process started', () => {
    const workspace = makeWorkspace({ '.env': 'A=from-file\nB=from-file\n' });
    try {
      const subfolder = join(workspace.path, '.choliba', 'agents');
      mkdirSync(subfolder, { recursive: true });
      const config = configFor(subfolder, { B: 'from-process' });

      expect(config.startDir()).toBe(subfolder);
      expect(config.workspaceRoot()).toBe(workspace.path);
      expect(config.workspaceRootOrNothing()).toBe(workspace.path);
      expect(config.load(workspace.path)).toMatchObject({ A: 'from-file', B: 'from-process' });
    } finally {
      workspace.cleanup();
    }
  });

  it('says how to make a workspace outside one, or gives nothing when asked to stay quiet', () => {
    const outside = makeTmpDir('no-workspace');
    try {
      const config = configFor(outside.path);

      expect(() => config.workspaceRoot()).toThrow(WorkspaceNotFoundError);
      expect(config.workspaceRootOrNothing()).toBeUndefined();
    } finally {
      outside.cleanup();
    }
  });
});
