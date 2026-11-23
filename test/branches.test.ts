import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, test } from 'bun:test';

import { cleanBranches } from '../scripts/branches';

let root: string;

function git(...args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
}

function commitFile(name: string, text: string): void {
  writeFileSync(join(root, name), text);
  git('add', name);
  git('commit', '-q', '-m', `muda ${name}`);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'choliba-branches-'));
  git('init', '-q', '-b', 'develop');
  git('config', 'user.name', 'dev');
  git('config', 'user.email', 'dev@example.com');
  commitFile('a.txt', 'a');
  git('branch', 'master');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test('apaga a branch mergeada de forma normal e mantém master e develop', async () => {
  git('switch', '-q', '-c', 'feat/normal');
  commitFile('b.txt', 'b');
  git('switch', '-q', 'develop');
  git('merge', '-q', '--no-ff', '-m', 'junta', 'feat/normal');

  const result = await cleanBranches(root);

  expect(result).toEqual({
    deleted: ['feat/normal'],
    skipped: [],
    switchedTo: undefined,
  });
  expect(git('branch', '--format=%(refname:short)').trim().split('\n')).toEqual(
    ['develop', 'master'],
  );
});

test('apaga a branch mergeada por squash e mantém a que ainda não foi', async () => {
  git('switch', '-q', '-c', 'feat/squash');
  commitFile('b.txt', 'b');
  git('switch', '-q', 'develop');
  git('merge', '-q', '--squash', 'feat/squash');
  git('commit', '-q', '-m', 'squash');
  git('switch', '-q', '-c', 'feat/aberta');
  commitFile('c.txt', 'c');
  git('switch', '-q', 'develop');

  const result = await cleanBranches(root);

  expect(result.deleted).toEqual(['feat/squash']);
  expect(result.skipped).toEqual(['feat/aberta']);
});

test('troca para a develop quando a branch atual é a que sai', async () => {
  git('switch', '-q', '-c', 'feat/atual');
  commitFile('b.txt', 'b');
  git('switch', '-q', 'develop');
  git('merge', '-q', '--no-ff', '-m', 'junta', 'feat/atual');
  git('switch', '-q', 'feat/atual');

  const result = await cleanBranches(root);

  expect(result.switchedTo).toBe('develop');
  expect(git('branch', '--show-current').trim()).toBe('develop');
});

test('recusa rodar com mudanças não commitadas', async () => {
  writeFileSync(join(root, 'a.txt'), 'mudou');

  await expect(cleanBranches(root)).rejects.toThrow(
    'há mudanças não commitadas',
  );
});

test('recusa rodar sem a branch develop', async () => {
  git('switch', '-q', 'master');
  git('branch', '-D', 'develop');

  await expect(cleanBranches(root)).rejects.toThrow(
    'a branch "develop" não existe',
  );
});
