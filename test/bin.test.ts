import { join } from 'node:path';

import { expect, test } from 'bun:test';

const BIN = join(import.meta.dir, '..', 'bin', 'choliba.ts');

test('choliba --help lista os comandos, com o clear', () => {
  const run = Bun.spawnSync([process.execPath, BIN, '--help']);

  expect(run.exitCode).toBe(0);
  const help = run.stdout.toString();
  for (const name of ['rounds', 'rounds:web', 'approvals', 'clear']) {
    expect(help).toMatch(new RegExp(`^  ${name} `, 'm'));
  }
});

test('choliba clear --help mostra as opções do clear', () => {
  const run = Bun.spawnSync([process.execPath, BIN, 'clear', '--help']);

  expect(run.exitCode).toBe(0);
  const help = run.stdout.toString();
  expect(help).toContain('Uso: choliba clear [opções]');
  for (const option of [
    '--all',
    '--logs',
    '--workspaces',
    '--homes',
    '--rounds',
    '--dry',
    '--yes',
  ]) {
    expect(help).toContain(option);
  }
});
