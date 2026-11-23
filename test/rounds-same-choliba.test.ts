import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, expect, test } from 'bun:test';

import { UsageError } from '../src/errors';
import {
  checkSameCholiba,
  cholibaFingerprint,
  installedCholiba,
  reinstallSteps,
} from '../src/rounds/same-choliba';

let base = '';

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'choliba-same-'));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

/** Writes `files` (path → text) under `root`. */
function write(root: string, files: Readonly<Record<string, string>>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

/** A Choliba's folder: its package.json and a source file with `code`. */
const choliba = (code: string): Record<string, string> => ({
  'package.json': JSON.stringify({ name: 'choliba', version: '0.1.0' }),
  'src/index.ts': code,
  // Not compared: the pages' sources do not ship as source.
  'src/rounds/web/src/App.tsx': String(Math.random()),
});

/** A project whose definition imports its own node_modules/choliba. */
function project(installedCode: string, spec = '/…/choliba-0.1.0.tgz'): string {
  const dir = join(base, 'projeto');
  write(dir, {
    'package.json': JSON.stringify({ dependencies: { choliba: spec } }),
    'rounds/definitions/rodada.ts': `import { x } from 'choliba';\n`,
  });
  write(join(dir, 'node_modules', 'choliba'), choliba(installedCode));
  return join(dir, 'rounds', 'definitions', 'rodada.ts');
}

test('código diferente: para antes de rodar, com as duas pastas e os comandos', () => {
  const running = join(base, 'repo');
  write(running, choliba('export const x = 2;'));
  const definition = project('export const x = 1;');

  expect(() => checkSameCholiba(definition, running)).toThrow(UsageError);
  let message = '';
  try {
    checkSameCholiba(definition, running);
  } catch (error) {
    message = error instanceof Error ? error.message : '';
  }
  expect(message).toContain(
    `importa: ${join(base, 'projeto', 'node_modules', 'choliba')} (0.1.0)`,
  );
  expect(message).toContain(`roda:    ${running} (0.1.0)`);
  expect(message).toContain(
    `cd ${running} && bun pm pack --filename /…/choliba-0.1.0.tgz`,
  );
  expect(message).toContain(
    `cd ${join(base, 'projeto')} && bun remove choliba && bun add /…/choliba-0.1.0.tgz`,
  );
});

test('mesmo código em outra pasta segue; as páginas não contam', () => {
  const running = join(base, 'repo');
  write(running, choliba('export const x = 1;'));
  const definition = project('export const x = 1;');
  expect(() => checkSameCholiba(definition, running)).not.toThrow();
  expect(cholibaFingerprint(running)).toBe(
    cholibaFingerprint(join(base, 'projeto', 'node_modules', 'choliba')),
  );
});

test('a própria cópia (o mesmo caminho real, por um link) segue', () => {
  const definition = project('export const x = 1;');
  const link = join(base, 'link');
  symlinkSync(join(base, 'projeto', 'node_modules', 'choliba'), link);
  expect(() => checkSameCholiba(definition, link)).not.toThrow();
});

test('uma definição que não importa o pacote choliba segue', () => {
  const running = join(base, 'repo');
  write(running, choliba('export const x = 2;'));
  const definition = join(base, 'solta', 'rodada.ts');
  write(base, { 'solta/rodada.ts': `import { x } from '../../src';\n` });
  expect(installedCholiba(definition)).toBeUndefined();
  expect(() => checkSameCholiba(definition, running)).not.toThrow();
});

test('reinstallSteps: um .tgz é gerado de novo e reinstalado; outra dependência é reinstalada da pasta que roda', () => {
  expect(
    reinstallSteps('/…/choliba', { dir: '/…/app', spec: 'file:/…/c.tgz' }),
  ).toEqual([
    'cd /…/choliba && bun pm pack --filename /…/c.tgz',
    'cd /…/app && bun remove choliba && bun add /…/c.tgz',
  ]);
  expect(
    reinstallSteps('/…/choliba', { dir: '/…/app', spec: '^0.1.0' }),
  ).toEqual(['cd /…/app && bun remove choliba && bun add /…/choliba']);
  expect(
    reinstallSteps('/…/choliba', { dir: '/…/app', spec: undefined }),
  ).toEqual(['cd /…/app && bun remove choliba && bun add /…/choliba']);
});

test('sem src, a impressão é a de nada; um package.json sem versão mostra ?', () => {
  const empty = join(base, 'vazio');
  mkdirSync(empty);
  expect(cholibaFingerprint(empty)).toBe(
    cholibaFingerprint(join(base, 'nada')),
  );
  const running = join(base, 'repo');
  write(running, { 'package.json': '{}', 'src/index.ts': 'a' });
  const definition = project('b', 'ainda-nao');
  expect(() => checkSameCholiba(definition, running)).toThrow(
    `roda:    ${running} (?)`,
  );
});
