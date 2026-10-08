import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Test } from '@nestjs/testing';
import { CommandTestFactory } from 'nest-commander-testing';

import { ExitStatus } from '@choliba/core/nest';
import { fakePlatform } from '@choliba/core/testing';

import { AppModule } from '../../app.module';
import type { CliRuntime } from '../../runtime';
import { defaultsPrompter } from '../../runtime';
import { fakeRuntime } from '../helpers/runtime';
import { WorkspaceService } from '../../workspace/workspace.service';
import { versionLines, workspaceAt, workspaceCholiba, workspaceEntries } from '../../workspace/workspace-choliba';

function runtime(capture: CliRuntime['capture']): CliRuntime {
  return {
    run: () => 0,
    capture,
    exec: () => 0,
    prompter: defaultsPrompter,
    interactive: false,
    packageDir: '/nowhere',
  };
}

function workspace(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'choliba-ws-'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  return root;
}

describe('the workspace choliba', () => {
  it('finds the workspace and the binary it installed', () => {
    expect(workspaceAt('/nowhere')).toBeUndefined();
    expect(workspaceCholiba('/ws')).toBe('/ws/node_modules/.bin/choliba');
    const root = workspace();
    try {
      expect(workspaceAt(path.join(root, 'sub'))).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists the workspace commands __entries returns, and none when it cannot', () => {
    const listed = workspaceEntries(
      runtime(() => ({
        status: 0,
        stdout: JSON.stringify([
          { name: 'agents', description: 'Lista os agentes' },
          { name: 1 },
          { description: 'sem nome' },
        ]),
        stderr: '',
      })),
      '/ws',
    );
    expect(listed).toEqual([
      {
        name: 'agents',
        description: 'Lista os agentes',
        group: 'Workspace commands',
        spec: { usage: 'choliba agents [ARGS]' },
      },
    ]);

    expect(
      workspaceEntries(
        runtime(() => ({ status: 1, stdout: '', stderr: '' })),
        '/ws',
      ),
    ).toEqual([]);
    expect(
      workspaceEntries(
        runtime(() => ({ status: 0, stdout: 'não json', stderr: '' })),
        '/ws',
      ),
    ).toEqual([]);
    expect(
      workspaceEntries(
        runtime(() => ({ status: 0, stdout: '{}', stderr: '' })),
        '/ws',
      ),
    ).toEqual([]);
  });

  it('prints both versions inside a workspace, and only its own outside', () => {
    expect(
      versionLines(
        'choliba-cli 0.0.1-dev',
        runtime(() => ({ status: 0, stdout: '', stderr: '' })),
        '/nowhere',
      ),
    ).toBe('choliba-cli 0.0.1-dev');
    const root = workspace();
    try {
      const shown = versionLines(
        'choliba-cli 0.0.1-dev',
        runtime((command, args) =>
          args[0] === '--version'
            ? { status: 0, stdout: 'choliba 0.0.1-dev\n', stderr: '' }
            : { status: 1, stdout: '', stderr: `${command} falhou` },
        ),
        root,
      );
      expect(shown).toBe(`choliba-cli 0.0.1-dev\ncholiba 0.0.1-dev (pasta de trabalho ${root})`);

      const unknown = versionLines(
        'choliba-cli 0.0.1-dev',
        runtime(() => ({ status: 1, stdout: '', stderr: '' })),
        root,
      );
      expect(unknown).toContain('choliba (versão desconhecida)');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists the workspace commands from the folder the command runs in, and none outside', async () => {
    const outside = await Test.createTestingModule({
      imports: [AppModule.forRoot(fakePlatform({ cwd: '/nowhere' }), fakeRuntime())],
    }).compile();
    expect(outside.get(WorkspaceService).helpEntries()).toEqual([]);
    await outside.close();

    const root = workspace();
    const inside = await Test.createTestingModule({
      imports: [
        AppModule.forRoot(
          fakePlatform({ cwd: root }),
          fakeRuntime({
            capture: () => ({
              status: 0,
              stdout: JSON.stringify([{ name: 'agents', description: 'Lista os agentes' }]),
              stderr: '',
            }),
          }),
        ),
      ],
    }).compile();
    try {
      expect(inside.get(WorkspaceService).helpEntries()).toEqual([
        {
          name: 'agents',
          description: 'Lista os agentes',
          group: 'Workspace commands',
          spec: { usage: 'choliba agents [ARGS]' },
        },
      ]);
    } finally {
      await inside.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs a command it does not have on the workspace choliba and returns its code', async () => {
    const root = workspace();
    const seen: string[] = [];
    const platform = fakePlatform({ argv: ['tests', '--help'], cwd: root });
    const app = await CommandTestFactory.createTestingCommand({
      imports: [
        AppModule.forRoot(
          platform,
          fakeRuntime({
            exec: (command, args, cwd) => {
              seen.push(`${cwd} ${command} ${args.join(' ')}`);
              return 4;
            },
          }),
        ),
      ],
    }).compile();
    try {
      await CommandTestFactory.runWithoutClosing(app, ['tests', '--help']);
      expect(app.get(ExitStatus).code()).toBe(4);
      expect(seen).toEqual([`${root} ${path.join(root, 'node_modules', '.bin', 'choliba')} tests --help`]);
    } finally {
      await app.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
