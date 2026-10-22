import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { envSource, fileSource } from '@choliba/config';
import { complete, coreShell, createShell, formatSuggestions } from '@choliba/core';
import { BufferWritable, fakePlatform, runShell, VERBS_ROOT, type FakePlatform } from '@choliba/core/testing';
import { AGENTS, agentsShell } from '@choliba/agents';

import { agentsCliSpec, agentsCommandsShell, runAgentEntry } from '../../commands/agents';
import { fakeSpawner, streamFromChunks } from '../../../../agents/src/__tests__/helpers/fake-spawner';
import { knownProvidersShell } from '../../../../agents/src/__tests__/helpers/providers-shell';

const FIXTURES = join(__dirname, '..', '..', '..', '..', 'agents', 'src', '__tests__', 'fixtures');

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

async function choliba(
  args: readonly string[],
  platform: Partial<FakePlatform>,
): Promise<{ code: number; platform: FakePlatform }> {
  const run = fakePlatform({ argv: [...args], ...platform });
  return {
    code: await runShell([coreShell, knownProvidersShell, agentsShell, agentsCommandsShell, VERBS_ROOT], run),
    platform: run,
  };
}

describe('choliba run agent and list agents', () => {
  it('lists the agents of the workspace, and prints the help of both', () =>
    withWorkspace(async (cwd) => {
      const list = await choliba(['list', 'agents'], { cwd });
      expect(list.code).toBe(0);
      expect(list.platform.stdout.text()).toContain('id: echo');

      const listHelp = await choliba(['list', 'agents', '--help'], { cwd });
      expect(listHelp.code).toBe(0);
      expect(listHelp.platform.stdout.text()).toContain('Usage:  choliba list agents [OPTIONS]');

      const help = await choliba(['run', 'agent', '--help'], { cwd });
      expect(help.platform.stdout.text()).toContain('Usage:  choliba run agent AGENT [OPTIONS] [TASK...]');
      expect(help.platform.stdout.text()).toContain('(auto, claude, claude-ollama, codex, cursor)');
      expect(help.platform.stdout.text()).not.toContain('list');
    }));

  it('prints the loaded agent details and its options from the app-owned help', () =>
    withWorkspace(async (cwd) => {
      const { code, platform } = await choliba(['run', 'agent', 'echo', '--help'], { cwd });

      expect(code).toBe(0);
      expect(platform.stdout.text()).toContain('id: echo');
      expect(platform.stdout.text()).toContain('Usage:  choliba run agent echo [OPTIONS] [TASK...]');
      expect(platform.stdout.text()).toContain('--dry-run');
    }));

  it('prints the agents help through the service callback when more options follow --help', () =>
    withWorkspace(async (cwd) => {
      const { code, platform } = await choliba(['run', 'agent', '--help', '--agents-dir', join(FIXTURES, 'agents')], {
        cwd,
      });

      expect(code).toBe(0);
      expect(platform.stdout.text()).toContain('Usage:  choliba run agent AGENT [OPTIONS] [TASK...]');
    }));

  it('refuses an argument list agents does not take', () =>
    withWorkspace(async (cwd) => {
      const { code, platform } = await choliba(['list', 'agents', '--nope'], { cwd });
      expect(code).toBe(1);
      expect(platform.stderr.text()).toBe("opção desconhecida: --nope.\nRun 'choliba list agents --help' for usage.\n");
    }));

  it('says an agent is unknown, suggesting the closest one', () =>
    withWorkspace(async (cwd) => {
      const { code, platform } = await choliba(['run', 'agent', 'ecoh', 'x'], { cwd });
      expect(code).toBe(1);
      expect(platform.stderr.text()).toBe(
        'agente desconhecido: ecoh. Você quis dizer "echo"?\nVeja os agentes com \'choliba list agents\'.\n',
      );
    }));

  it('runs an agent through the provider found on PATH, in the colors of the theme', () =>
    withWorkspace(async (cwd) => {
      const { code, platform } = await choliba(['run', 'agent', 'echo', 'repita isto'], {
        cwd,
        env: {
          HOME: tmpdir(),
          CLAUDE_CODE_OAUTH_TOKEN: 'test-token',
          FORCE_COLOR: '1',
          CHOL_COLORS: 'agents.echo=gray',
          TERM: 'dumb',
        },
        which: (bin) => (bin === 'claude' ? '/usr/bin/true' : null),
        spawn: fakeSpawner({ stdout: streamFromChunks(claudeStdout('repetido')) }).spawner,
        stdout: new BufferWritable(true),
      });

      expect(platform.stderr.text()).toMatch(/^log em .*\/\.cache\/logs\/echo\/.*\.log\n$/);
      expect(code).toBe(0);
      const out = platform.stdout.text();
      expect(out).toContain('\u001b[35m[provider]\u001b[0m \u001b[35mclaude\u001b[0m');
      expect(out).toContain('\u001b[32m[echo]\u001b[0m repetido');
    }));
});

describe('runAgentEntry', () => {
  it('lists `agent` with the spec read now, or with the reference spec when the workspace cannot be read', () => {
    const reference = (): { usage: string } => ({ usage: 'referência' });

    expect(runAgentEntry(() => ({ usage: 'lido' }), reference).spec).toEqual({ usage: 'lido' });
    expect(
      runAgentEntry(() => {
        throw new Error('sem pasta de trabalho');
      }, reference).spec,
    ).toEqual({ usage: 'referência' });
  });
});

describe('the app-owned agents help spec', () => {
  it('completes the agents on disk and the providers', () =>
    withWorkspace((cwd) => {
      const platform = fakePlatform({ cwd });
      const service = createShell(
        platform,
        [coreShell, knownProvidersShell, agentsShell, agentsCommandsShell, VERBS_ROOT],
        [envSource(platform.env), fileSource(join(cwd, '.env'))],
      )
        .container.get(AGENTS)
        .helpContext();
      const spec = agentsCliSpec(service);

      expect(formatSuggestions(complete(spec, ['ec']))).toBe('echo');
      expect(formatSuggestions(complete(spec, ['l']))).toBe('');
      expect(formatSuggestions(complete(spec, ['echo', '--provider', '']))).toBe('auto\nclaude\ncursor');
      // --model: every model the agent declares, or only those of the provider already typed.
      expect(formatSuggestions(complete(spec, ['echo', '--model', '']))).toBe('claude-3-5-sonnet\ngpt-4o');
      expect(formatSuggestions(complete(spec, ['echo', '--provider', 'cursor', '--model', '']))).toBe('gpt-4o');
      return Promise.resolve();
    }));
});
