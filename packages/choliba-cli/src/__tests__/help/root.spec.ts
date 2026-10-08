import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CommandTestFactory } from 'nest-commander-testing';

import { ExitStatus } from '@choliba/core/nest';
import { fakePlatform } from '@choliba/core/testing';

import { AppModule } from '../../app.module';
import { versionLine } from '../../help/version';
import { fakeRuntime } from '../helpers/runtime';

async function run(argv: readonly string[], packageDir = '/nowhere') {
  const platform = fakePlatform({ argv: [...argv] });
  const app = await CommandTestFactory.createTestingCommand({
    imports: [AppModule.forRoot(platform, fakeRuntime({ packageDir }))],
  }).compile();
  await CommandTestFactory.runWithoutClosing(app, [...argv]);
  const code = app.get(ExitStatus).code();
  await app.close();
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba', () => {
  it('prints its help with no command, help, --help or -h', async () => {
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      const { code, out } = await run(argv);
      expect(code).toBe(0);
      expect(out).toContain('Usage:  choliba COMMAND [ARGS]');
      expect(out).toContain('new');
      expect(out).toContain('generate');
      expect(out).toContain('add');
      expect(out).toContain('choliba new minha-pasta');
    }
  });

  it('prints its version, from its package.json', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'choliba-cli-version-'));
    try {
      writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'choliba-cli', version: '0.0.1-dev.25', gitHead: '1a2b3c4d5e' }),
      );
      expect((await run(['--version'], dir)).out).toBe('choliba-cli 0.0.1-dev.25+1a2b3c4\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('outside a workspace, a command it does not have says to create one', async () => {
    const { code, err } = await run(['agents']);
    expect(code).toBe(1);
    expect(err).toBe(
      '/nowhere não está numa pasta de trabalho do choliba: crie uma com `choliba new` ou entre numa.\n',
    );
  });
});

describe('versionLine', () => {
  it('reads the version, the commit when there is one, and says when it cannot', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'choliba-cli-version-'));
    try {
      expect(versionLine(dir)).toBe('choliba-cli (versão desconhecida)');
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify(['x']));
      expect(versionLine(dir)).toBe('choliba-cli (versão desconhecida)');
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'choliba-cli', version: '0.0.1-dev' }));
      expect(versionLine(dir)).toBe('choliba-cli 0.0.1-dev');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
