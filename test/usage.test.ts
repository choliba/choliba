import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, test } from 'bun:test';

import { clearConfigCache } from '../src/config/index';
import type { Interaction } from '../src/interaction/index';
import { runScript, UsageError } from '../src/usage';
import { readLogRecords } from './support/log-records';

let cwd: string;

beforeEach(() => {
  clearConfigCache();
  cwd = mkdtempSync(join(tmpdir(), 'choliba-usage-'));
  writeFileSync(
    join(cwd, 'choliba.config.ts'),
    `export default { logger: { dir: 'logs' } };\n`,
  );
});

afterEach(() => {
  clearConfigCache();
  rmSync(cwd, { recursive: true, force: true });
});

/** An output that keeps what is written and what is shown as an error. */
function recorder(): {
  written: string[];
  errors: string[];
  output: Interaction;
} {
  const written: string[] = [];
  const errors: string[] = [];
  const output: Interaction = {
    ask: () => Promise.resolve(''),
    write: (value) => written.push(value),
    error: (value) => errors.push(value),
  };
  return { written, errors, output };
}

test('runScript mostra UsageError como erro, termina pelo onFailure, registra e não relança', async () => {
  const { written, errors, output } = recorder();
  let failures = 0;

  await runScript(() => Promise.reject(new UsageError('use docker build')), {
    output,
    config: { cwd },
    onFailure: () => {
      failures += 1;
    },
  });

  expect(errors).toEqual(['use docker build']);
  expect(written).toEqual([]);
  expect(failures).toBe(1);
  expect(errorRecords(join(cwd, 'logs'))).toEqual([
    expect.objectContaining({
      'log.level': 'error',
      event: { name: 'error' },
      message: 'use docker build',
      error: { message: 'use docker build' },
    }),
  ]);
});

test('runScript termina pelo onFailure também quando a config é recusada', async () => {
  writeFileSync(
    join(cwd, 'choliba.config.ts'),
    `export default { nada: 1 };\n`,
  );
  const { errors, output } = recorder();
  let ran = false;
  let failures = 0;

  await runScript(
    () => {
      ran = true;
      return Promise.resolve();
    },
    {
      output,
      config: { cwd },
      onFailure: () => {
        failures += 1;
      },
    },
  );

  expect(ran).toBe(false);
  expect(failures).toBe(1);
  expect(errors.join('\n')).toContain('Opção desconhecida "nada"');
});

test('sem onFailure, um erro de uso põe o código de saída 1', async () => {
  const { errors, output } = recorder();
  const before = process.exitCode;
  try {
    await runScript(() => Promise.reject(new UsageError('use docker build')), {
      output,
      config: { cwd },
    });
    expect(process.exitCode).toBe(1);
  } finally {
    // Bun keeps the last code when given undefined.
    process.exitCode = before ?? 0;
  }
  expect(errors).toEqual(['use docker build']);
});

test('runScript registra e relança outros erros', async () => {
  await expect(
    runScript(() => Promise.reject(new Error('falha interna')), {
      config: { cwd },
    }),
  ).rejects.toThrow('falha interna');

  expect(errorRecords(join(cwd, 'logs'))).toEqual([
    expect.objectContaining({ message: 'falha interna' }),
  ]);
});

test('runScript trata o SIGINT repetido do mesmo Ctrl+C como um só', async () => {
  const exit = process.exit.bind(process);
  const exits: unknown[] = [];
  process.exit = (code?: number | string | null): never => {
    exits.push(code);
    throw new Error('process.exit chamado');
  };

  try {
    await runScript(
      async ({ signal }) => {
        // Under `bun run` one Ctrl+C arrives twice: from the terminal and the runner.
        process.emit('SIGINT');
        process.emit('SIGINT');
        expect(signal.aborted).toBe(true);
      },
      { config: { cwd } },
    );
  } finally {
    process.exit = exit;
  }

  expect(exits).toEqual([]);
});

/** Error records of the log: told apart by level, not by folder. */
function errorRecords(logDir: string): Record<string, unknown>[] {
  return readLogRecords(logDir).filter(
    (record) => record['log.level'] === 'error',
  );
}
