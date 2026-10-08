import { Test } from '@nestjs/testing';

import { complete, formatSuggestions } from '@choliba/core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PlatformModule, RuntimeModule } from '@choliba/core/nest';
import { fakePlatform, runCommand } from '@choliba/core/testing';

import { AddCommand } from '../../add/add.command';
import { AddModule } from '../../add/nest';
import { agentYaml } from '../../generate/agent-yaml';
import { fakeRuntime } from '../helpers/runtime';

interface Scene {
  readonly root: string;
  readonly source: string;
  readonly workspace: string;
}

function scene(): Scene {
  const root = mkdtempSync(path.join(tmpdir(), 'choliba-add-'));
  const source = path.join(root, 'origem', 'revisor');
  const workspace = path.join(root, 'ws');
  mkdirSync(source, { recursive: true });
  mkdirSync(workspace);
  writeFileSync(
    path.join(source, 'agent.yaml'),
    agentYaml({
      name: 'revisor',
      description: 'Revisa código.',
      role: 'Você revisa código.',
      models: ['claude-sonnet-5'],
      project: false,
      access: 'nada',
    }),
  );
  writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  writeFileSync(path.join(workspace, '.env'), 'CHOL_GLOBAL_DIR=/tmp/global\n');
  return { root, source, workspace };
}

async function run(cwd: string, argv: readonly string[]): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['add', ...argv], cwd });
  const code = await runCommand([RuntimeModule.forRoot(fakeRuntime()), AddModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba add', () => {
  let laid: Scene;
  beforeEach(() => {
    laid = scene();
  });
  afterEach(() => {
    rmSync(laid.root, { recursive: true, force: true });
  });

  it('prints its help', async () => {
    const ran = await run(laid.workspace, ['--help']);
    expect(ran.code).toBe(0);
    expect(ran.out).toContain('Usage:  choliba add <origem> [OPTIONS]');
    expect(ran.out).toContain('--dry-run');
    expect(ran.out).toContain('--path');
  });

  it('installs an agent from a folder, and --dry-run writes nothing', async () => {
    const preview = await run(laid.workspace, [laid.source, '--dry-run']);
    const installed = path.join(laid.workspace, '.choliba', 'agents', 'revisor', 'agent.yaml');
    expect(preview.code).toBe(0);
    expect(preview.out).toContain('Instalaria (--dry-run, nada foi gravado):');
    expect(preview.out).toContain('agente revisor');
    expect(existsSync(installed)).toBe(false);

    const ran = await run(laid.workspace, ['--path', 'revisor', path.join(laid.root, 'origem')]);
    expect(ran.code).toBe(0);
    expect(ran.out).toContain('Instalado:');
    expect(ran.out).toContain('agente revisor');
    expect(existsSync(installed)).toBe(true);
  });

  it('completes the origin and --path, and asks bun for an npm package', async () => {
    const module = await Test.createTestingModule({
      imports: [
        PlatformModule.forRoot(fakePlatform({ cwd: laid.workspace })),
        RuntimeModule.forRoot(fakeRuntime()),
        AddModule,
      ],
    }).compile();
    try {
      const spec = module.get(AddCommand).helpEntries()[0]?.spec;
      expect(spec).toBeDefined();
      if (spec !== undefined) {
        expect(typeof formatSuggestions(complete(spec, ['']))).toBe('string');
        expect(typeof formatSuggestions(complete(spec, ['--path', '']))).toBe('string');
      }
    } finally {
      await module.close();
    }

    const runtime = fakeRuntime();
    const platform = fakePlatform({ argv: ['add', 'pacote-x'], cwd: laid.workspace });
    const code = await runCommand([RuntimeModule.forRoot(runtime), AddModule], platform);
    expect(code).toBe(1);
    expect(runtime.calls.some((line) => line.includes('bun add pacote-x'))).toBe(true);
  });

  it('fails without an origin, with two origins and outside a workspace', async () => {
    const none = await run(laid.workspace, []);
    expect(none.code).toBe(1);
    expect(none.err).toContain('choliba add <origem>');

    const two = await run(laid.workspace, [laid.source, laid.source]);
    expect(two.code).toBe(1);
    expect(two.err).toContain('uma origem só');

    const outside = mkdtempSync(path.join(tmpdir(), 'choliba-add-out-'));
    try {
      const ran = await run(outside, [laid.source]);
      expect(ran.code).toBe(1);
      expect(ran.err).toContain('Nenhuma pasta de trabalho do choliba');
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
