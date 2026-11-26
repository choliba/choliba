import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, test } from 'bun:test';

import { UsageError } from '../src/errors';
import { bundleHelper } from '../src/execute/bundle';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'choliba-bundle-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('bundleHelper monta o auxiliar e o que ele importa num arquivo só', async () => {
  writeFileSync(join(dir, 'parte.ts'), "export const parte = 'montado';\n");
  writeFileSync(
    join(dir, 'main.ts'),
    "import { parte } from './parte';\nprocess.stdout.write(parte);\n",
  );

  await bundleHelper({
    entry: join(dir, 'main.ts'),
    dir: join(dir, 'saida'),
    file: 'auxiliar.js',
    what: 'o teste',
  });

  const run = spawnSync(process.execPath, [join(dir, 'saida', 'auxiliar.js')], {
    encoding: 'utf8',
  });
  expect(run.stdout).toBe('montado');
});

test('bundleHelper recusa uma montagem que falha com um UsageError que diz o quê e por quê', async () => {
  writeFileSync(
    join(dir, 'main.ts'),
    "import { nada } from './nao-existe';\nprocess.stdout.write(nada);\n",
  );

  const failure = bundleHelper({
    entry: join(dir, 'main.ts'),
    dir: join(dir, 'saida'),
    file: 'auxiliar.js',
    what: 'o teste',
  });

  await expect(failure).rejects.toThrow(UsageError);
  await expect(failure).rejects.toThrow('Não foi possível preparar o teste: ');
  await expect(failure).rejects.toThrow('nao-existe');
});
