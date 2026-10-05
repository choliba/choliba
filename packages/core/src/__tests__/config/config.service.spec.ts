import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { Test } from '@nestjs/testing';

import { WorkspaceNotFoundError } from '../../config';
import { ConfigModule, ConfigService, PlatformModule } from '../../nest';
import { fakePlatform } from '../../testing';
import { makeTmpDir } from '../helpers/tmp';
import { makeWorkspace } from '../helpers/workspace';

async function configFor(cwd: string, env: Readonly<Record<string, string>> = {}): Promise<ConfigService> {
  const moduleRef = await Test.createTestingModule({
    imports: [PlatformModule.forRoot(fakePlatform({ cwd, env })), ConfigModule],
  }).compile();
  return moduleRef.get(ConfigService);
}

describe('ConfigService', () => {
  it('finds the workspace from a subfolder of where the process started', async () => {
    const workspace = makeWorkspace({ '.env': 'A=from-file\nB=from-file\n' });
    try {
      const subfolder = join(workspace.path, '.choliba', 'agents');
      mkdirSync(subfolder, { recursive: true });
      const config = await configFor(subfolder, { B: 'from-process' });

      expect(config.startDir()).toBe(subfolder);
      expect(config.workspaceRoot()).toBe(workspace.path);
      expect(config.workspaceRootOrNothing()).toBe(workspace.path);
      expect(config.load(workspace.path)).toMatchObject({ A: 'from-file', B: 'from-process' });
    } finally {
      workspace.cleanup();
    }
  });

  it('says how to make a workspace outside one, or gives nothing when asked to stay quiet', async () => {
    const outside = makeTmpDir('no-workspace');
    try {
      const config = await configFor(outside.path);

      expect(() => config.workspaceRoot()).toThrow(WorkspaceNotFoundError);
      expect(config.workspaceRootOrNothing()).toBeUndefined();
    } finally {
      outside.cleanup();
    }
  });
});
