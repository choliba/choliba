import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { fakePlatform, runCommand } from '@choliba/core/testing';

import { GenerateModule } from '../../generate/nest';
import type { CliRuntime } from '../../runtime/interfaces/runtime.interface';
import { RuntimeModule } from '@choliba/core/nest';
import { type FakeRuntime, fakeRuntime } from '../helpers/runtime';

interface Ran {
  readonly code: number;
  readonly out: string;
  readonly err: string;
  readonly runtime: FakeRuntime;
}

/** A workspace: a folder whose package.json depends on the choliba. */
function workspace(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'choliba-cli-ws-'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  return root;
}

async function run(
  cwd: string,
  argv: readonly string[],
  overrides: Partial<CliRuntime> = {},
  checkCode = 0,
  word = 'generate',
): Promise<Ran> {
  const runtime = fakeRuntime(overrides, checkCode);
  const platform = fakePlatform({ argv: [word, ...argv], cwd });
  const code = await runCommand([RuntimeModule.forRoot(runtime), GenerateModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text(), runtime };
}

const FLAGS = ['--description', 'Revisa', '--role', 'Você revisa.', '--no-input'];

describe('choliba generate', () => {
  let root: string;
  beforeEach(() => {
    root = workspace();
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('prints its help, and refuses an unknown type', async () => {
    for (const argv of [[], ['--help'], ['help']]) {
      const ran = await run(root, argv);
      expect(ran.code).toBe(0);
      expect(ran.out).toContain('Usage:  choliba generate TYPE [ARGS]');
      expect(ran.out).toContain('Cria um agente novo');
    }
    const unknown = await run(root, ['apaga']);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain('tipo desconhecido: apaga.');
  });

  it('prints the help of agent, also through the alias g', async () => {
    for (const word of ['generate', 'g']) {
      const ran = await run(root, ['agent', '--help'], {}, 0, word);
      expect(ran.code).toBe(0);
      expect(ran.out).toContain('Usage:  choliba generate agent [NOME] [OPTIONS]');
      expect(ran.out).toContain('--access');
    }
  });

  it('creates the agent from a subfolder of the workspace, the summary on stdout', async () => {
    mkdirSync(path.join(root, 'sub'));
    const ran = await run(path.join(root, 'sub'), ['agent', 'revisor', ...FLAGS]);
    const file = path.join(root, '.choliba', 'agents', 'revisor', 'agent.yaml');
    expect(ran.code).toBe(0);
    expect(existsSync(file)).toBe(true);
    expect(ran.out).toContain(`Agente revisor criado: ${file}`);
    expect(ran.err).toContain(`agente criado: ${file}\n`);
    expect(ran.runtime.calls).toEqual([`${path.basename(root)}$ bunx choliba check`]);
  });

  it('asks on a terminal, and exits 1 when the check finds problems', async () => {
    const ran = await run(root, ['agent', 'revisor'], { interactive: true }, 1);
    expect(ran.code).toBe(1);
    expect(ran.out).toContain('apontou o que corrigir');
  });

  it('fails on a bad command line, an agent that exists, and outside a workspace', async () => {
    const usage = await run(root, ['agent', '--quem']);
    expect(usage.code).toBe(1);
    expect(usage.err).toContain("Run 'choliba generate agent --help' for usage.");

    await run(root, ['agent', 'revisor', ...FLAGS]);
    const again = await run(root, ['agent', 'revisor', ...FLAGS]);
    expect(again.code).toBe(1);
    expect(again.err).toContain('erro: o agente revisor já existe');

    const outside = mkdtempSync(path.join(tmpdir(), 'choliba-out-'));
    try {
      const ran = await run(outside, ['agent', 'revisor', ...FLAGS]);
      expect(ran.code).toBe(1);
      expect(ran.err).toContain('erro: Nenhuma pasta de trabalho do choliba');
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
