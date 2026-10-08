import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Test } from '@nestjs/testing';

import { PlatformModule, RuntimeModule } from '@choliba/core/nest';
import { fakePlatform, runCommand } from '@choliba/core/testing';

import { agentYaml } from '../../generate/agent-yaml';
import { NewCommand } from '../../new/new.command';

import { NewModule } from '../../new/new.module';
import { CHOLIBA_PACKAGE } from '../../new/new-options';
import type { CliRuntime } from '../../runtime/interfaces/runtime.interface';
import { type FakeRuntime, fakeRuntime } from '../helpers/runtime';

interface Ran {
  readonly code: number;
  readonly out: string;
  readonly err: string;
  readonly cwd: string;
  readonly runtime: FakeRuntime;
}

async function run(
  argv: readonly string[],
  overrides: Partial<CliRuntime> = {},
  checkCode = 0,
  prepare?: (cwd: string) => void,
): Promise<Ran> {
  const cwd = mkdtempSync(path.join(tmpdir(), 'choliba-cli-new-'));
  prepare?.(cwd);
  const runtime = fakeRuntime(overrides, checkCode);
  const platform = fakePlatform({ argv: ['new', ...argv], cwd });
  const code = await runCommand([RuntimeModule.forRoot(runtime), NewModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text(), cwd, runtime };
}

function cleanup(ran: Ran): void {
  rmSync(ran.cwd, { recursive: true, force: true });
}

function writeAgentSource(cwd: string): void {
  const dir = path.join(cwd, 'origem', '.choliba', 'agents', 'test-writer');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'agent.yaml'),
    agentYaml({
      name: 'test-writer',
      description: 'Escreve testes.',
      role: 'Você escreve testes.',
      models: ['claude-sonnet-5'],
      project: true,
      access: 'leitura',
    }),
  );
}

describe('choliba new', () => {
  it('prints its help, leading with examples', async () => {
    const ran = await run(['--help']);
    expect(ran.code).toBe(0);
    expect(ran.out).toContain('Usage:  choliba new [PASTA] [OPTIONS]');
    expect(ran.out).toContain('choliba new minha-pasta --provider claude');
    expect(ran.out).toContain('--no-input');
    expect(ran.runtime.calls).toEqual([]);
    cleanup(ran);
  });

  it('creates the workspace without questions, saying each step on stderr and the result on stdout', async () => {
    const ran = await run(
      ['ws', '--provider', 'cursor', '--agents', 'test-writer', '--agents-from', 'origem', '--no-input'],
      {},
      0,
      writeAgentSource,
    );
    try {
      expect(ran.code).toBe(0);
      expect(ran.runtime.calls).toEqual([`ws$ bun add --trust ${CHOLIBA_PACKAGE}`, 'ws$ bunx choliba check']);
      expect(
        readFileSync(path.join(ran.cwd, 'ws', '.choliba', 'agents', 'test-writer', 'agent.yaml'), 'utf8'),
      ).toContain('id: test-writer');
      expect(readFileSync(path.join(ran.cwd, 'ws', '.env'), 'utf8')).toBe('CHOL_AGENTS_PROVIDER=cursor\n');
      expect(ran.err).toContain(`instalando o choliba: bun add --trust ${CHOLIBA_PACKAGE}\n`);
      expect(ran.err).toContain('instalando o test-writer: choliba add origem --path .choliba/agents/test-writer\n');
      expect(ran.out).toContain(`Pasta de trabalho pronta: ${path.join(ran.cwd, 'ws')}`);
    } finally {
      cleanup(ran);
    }
  });

  it('asks on a terminal, and not with --no-input', async () => {
    const asked = await run([], { interactive: true });
    const quiet = await run(['--no-input', '--no-agents'], { interactive: true });
    try {
      expect(asked.out).toContain(path.join(asked.cwd, 'perguntada'));
      expect(quiet.out).toContain(path.join(quiet.cwd, 'choliba'));
    } finally {
      cleanup(asked);
      cleanup(quiet);
    }
  });

  it('exits 1 when the check finds problems', async () => {
    const ran = await run(['ws', '--no-agents'], {}, 1);
    expect(ran.code).toBe(1);
    expect(ran.out).toContain('criada, mas o `choliba check` apontou o que corrigir');
    cleanup(ran);
  });

  it('refuses a wrong command line, and says why a step could not be done', async () => {
    const wrong = await run(['--provider', 'x']);
    expect(wrong.code).toBe(1);
    expect(wrong.err).toBe(`--provider aceita auto, claude, cursor (veio "x").\nRun 'choliba new --help' for usage.\n`);

    const taken = await run([]);
    mkdirSync(path.join(taken.cwd, 'ocupada'));
    writeFileSync(path.join(taken.cwd, 'ocupada', 'x'), '');
    const platform = fakePlatform({ argv: ['new', 'ocupada'], cwd: taken.cwd });
    expect(await runCommand([RuntimeModule.forRoot(fakeRuntime()), NewModule], platform)).toBe(1);
    expect(platform.stderr.text()).toBe(
      `erro: a pasta ${path.join(taken.cwd, 'ocupada')} já existe e não está vazia; escolha outra.\n`,
    );
    cleanup(wrong);
    cleanup(taken);
  });

  it('lets an unexpected error through', async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'choliba-cli-new-'));
    try {
      const runtime = fakeRuntime({
        run: () => {
          throw new Error('bug');
        },
      });
      const platform = fakePlatform({ argv: ['new', 'ws', '--no-input'], cwd });
      // nest-commander reports what a command throws through main.ts's serviceErrorHandler, so the command is run here.
      const module = await Test.createTestingModule({
        imports: [PlatformModule.forRoot(platform), RuntimeModule.forRoot(runtime), NewModule],
      }).compile();
      await expect(module.get(NewCommand).run()).rejects.toThrow('bug');
      await module.close();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
