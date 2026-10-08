import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Test } from '@nestjs/testing';

import { complete, formatSuggestions } from '@choliba/core';
import { PlatformModule } from '@choliba/core/nest';
import { BufferWritable, fakePlatform, runCommand, type FakePlatform } from '@choliba/core/testing';

import { AgentsModule, AgentsService } from '../../nest';
import { fakeSpawner, streamFromChunks } from '../helpers/fake-spawner';

const FIXTURES = join(__dirname, '..', 'fixtures');

/** A workspace whose agents, skills and MCPs are the fixtures. */
async function withWorkspace(fn: (root: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'agents-cmd-'));
  mkdirSync(join(root, '.cache'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  writeFileSync(
    join(root, '.env'),
    ['agents', 'skills', 'mcps'].map((dir) => `CHOL_${dir.toUpperCase()}_DIR=${join(FIXTURES, dir)}\n`).join(''),
  );
  try {
    await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function claudeStdout(text: string): readonly string[] {
  return [
    `${JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-3-5-sonnet', session_id: 's' })}\n`,
    `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } })}\n`,
    `${JSON.stringify({ type: 'result', is_error: false, result: 'ok' })}\n`,
  ];
}

async function agents(
  args: readonly string[],
  platform: Partial<FakePlatform>,
): Promise<{ code: number; platform: FakePlatform }> {
  const run = fakePlatform({ argv: ['agents', ...args], ...platform });
  return { code: await runCommand([AgentsModule], run), platform: run };
}

describe('choliba agents', () => {
  it('lists the agents of the workspace, and prints its help', () =>
    withWorkspace(async (cwd) => {
      const list = await agents(['list'], { cwd });
      expect(list.code).toBe(0);
      expect(list.platform.stdout.text()).toContain('id: echo');

      const help = await agents(['--help'], { cwd });
      expect(help.platform.stdout.text()).toContain('Usage:  choliba agents [OPTIONS] COMMAND [TASK...]');
      expect(help.platform.stdout.text()).toContain('provider (auto, claude, cursor)');
    }));

  it('runs an agent through the provider found on PATH, in the colors of the theme', () =>
    withWorkspace(async (cwd) => {
      const { code, platform } = await agents(['echo', 'repita isto'], {
        cwd,
        env: { FORCE_COLOR: '1', CHOL_COLORS: 'agents.echo=gray' },
        which: (bin) => (bin === 'claude' ? '/usr/bin/claude' : null),
        spawn: fakeSpawner({ stdout: streamFromChunks(claudeStdout('repetido')) }).spawner,
        stdout: new BufferWritable(true),
      });

      expect(platform.stderr.text()).toBe('');
      expect(code).toBe(0);
      const out = platform.stdout.text();
      expect(out).toContain('\u001b[35m[provider]\u001b[0m \u001b[35mclaude\u001b[0m');
      expect(out).toContain('\u001b[90m[echo]\u001b[0m repetido');
    }));

  it('says what is wrong, with exit code 1, outside a workspace', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'agents-outside-'));
    try {
      const { code, platform } = await agents(['list'], { cwd: outside });
      expect(code).toBe(1);
      expect(platform.stderr.text()).toContain('Nenhuma pasta de trabalho do choliba');
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('AgentsService.helpSpec', () => {
  it('completes the agents on disk, the commands and the providers', () =>
    withWorkspace(async (cwd) => {
      const moduleRef = await Test.createTestingModule({
        imports: [PlatformModule.forRoot(fakePlatform({ cwd })), AgentsModule],
      }).compile();
      await moduleRef.init();
      const spec = moduleRef.get(AgentsService).helpSpec();

      expect(formatSuggestions(complete(spec, ['ec']))).toBe('echo');
      expect(formatSuggestions(complete(spec, ['echo', '--provider', '']))).toBe('auto\nclaude\ncursor');
    }));
});
