import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { UsageError } from '../src/usage';
import { Workspace } from '../src/workspace/index';
import {
  findPrograms,
  programAt,
  programDirs,
  requirePrograms,
  visiblePrograms,
} from '../src/workspace/sandbox/programs';

const base = realpathSync(mkdtempSync(join(tmpdir(), 'choliba-programs-')));
const usrBin = join(base, 'usr/bin');
const localBin = join(base, 'home/.local/bin');
const linkedBin = join(base, 'bin');
mkdirSync(usrBin, { recursive: true });
mkdirSync(localBin, { recursive: true });
symlinkSync(usrBin, linkedBin);

/** An executable file in `dir`. */
function program(dir: string, name: string): string {
  const path = join(dir, name);
  writeFileSync(path, '#!/bin/sh\n');
  chmodSync(path, 0o755);
  return path;
}

program(usrBin, 'php8.5');
symlinkSync('php8.5', join(usrBin, 'php'));
program(usrBin, 'node');
program(localBin, 'node');
mkdirSync(join(usrBin, 'pasta'));

const searchPath = `${localBin}:${linkedBin}:${usrBin}`;

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('programas da sandbox', () => {
  test('acha cada programa como o shell: primeiro no PATH, pelo arquivo final do link', () => {
    expect(findPrograms(['php', 'node'], searchPath)).toEqual({
      found: [
        // Through `bin`, a link to `usr/bin`: mounted at the real folder.
        {
          name: 'php',
          path: join(usrBin, 'php'),
          file: join(usrBin, 'php8.5'),
        },
        {
          name: 'node',
          path: join(localBin, 'node'),
          file: join(localBin, 'node'),
        },
      ],
      missing: [],
    });
  });

  test('o que não está no PATH, ou é pasta, falta; repetido conta uma vez', () => {
    expect(findPrograms(['composer', 'pasta', 'composer'], searchPath)).toEqual(
      { found: [], missing: ['composer', 'pasta'] },
    );
    expect(findPrograms(['php'], undefined).missing).toEqual(['php']);
  });

  test('recusa caminho, pacote com espaço e nome vazio', () => {
    for (const name of ['/usr/bin/php', 'php cli', '', '..']) {
      expect(() => findPrograms([name], searchPath)).toThrow(UsageError);
    }
    expect(() => findPrograms(['/usr/bin/php'], searchPath)).toThrow(
      'Programa inválido em programs: "/usr/bin/php". Use o nome do executável, como php (não o caminho nem o pacote).',
    );
  });

  test('requirePrograms para nomeando o que falta', () => {
    expect(
      requirePrograms(['php'], searchPath).map((found) => found.name),
    ).toEqual(['php']);
    expect(() =>
      requirePrograms(['php', 'composer', 'go'], searchPath),
    ).toThrow(
      'Programas selecionados que a sandbox não encontra: composer, go. Instale no host, numa pasta do PATH, ou tire da lista programs.',
    );
  });

  test('programAt: um executável por caminho absoluto; pasta ou inexistente, nada', () => {
    expect(programAt(join(linkedBin, 'php'))).toEqual({
      name: 'php',
      path: join(usrBin, 'php'),
      file: join(usrBin, 'php8.5'),
    });
    expect(programAt(usrBin)).toBeUndefined();
    expect(programAt(join(base, 'nada'))).toBeUndefined();
  });

  test('visiblePrograms: os selecionados, a base que existe e o runtime, sem repetir', () => {
    const visible = visiblePrograms(['php', 'node'], searchPath, [
      'node',
      'sh-que-nao-existe',
    ]);
    const names = visible.map((found) => found.name);

    expect(names.slice(0, 2)).toEqual(['php', 'node']);
    expect(names.filter((name) => name === 'node')).toHaveLength(1);
    expect(names).not.toContain('sh-que-nao-existe');
    // Choliba's runtime, by its own path.
    expect(visible.at(-1)?.file).toBe(realpathSync(process.execPath));
    expect(() => visiblePrograms(['composer'], searchPath, [])).toThrow(
      UsageError,
    );
  });

  test('programDirs: pastas do sistema, do home e do PATH, reais, sem as graváveis', () => {
    const home = join(base, 'home');
    const dirs = programDirs(
      `${searchPath}:relativa:${join(base, 'nada')}`,
      home,
      [localBin],
    );

    expect(dirs).toContain(usrBin);
    expect(dirs).not.toContain(linkedBin);
    expect(dirs).not.toContain(localBin);
    expect(dirs).not.toContain('relativa');
    expect(dirs).not.toContain(join(base, 'nada'));
    expect(dirs.filter((dir) => dir === usrBin)).toHaveLength(1);
    expect(dirs).toContain(realpathSync('/usr/bin'));
  });
});

describe('Workspace.programs', () => {
  test('guarda a seleção e confere sem rodar nada', () => {
    const workspace = new Workspace({
      type: 'bubblewrap',
      root: base,
      programs: ['php', 'composer'],
    });

    expect(workspace.programs).toEqual(['php', 'composer']);
    expect(workspace.checkPrograms(undefined, searchPath)).toEqual({
      found: [
        {
          name: 'php',
          path: join(usrBin, 'php'),
          file: join(usrBin, 'php8.5'),
        },
      ],
      missing: ['composer'],
    });
    expect(workspace.checkPrograms(['node'], searchPath).found).toHaveLength(1);
  });

  test('sem programs, nenhuma seleção; um nome inválido é recusado ao criar', () => {
    const workspace = new Workspace({ type: 'bubblewrap', root: base });

    expect(workspace.programs).toBeUndefined();
    expect(workspace.checkPrograms()).toEqual({ found: [], missing: [] });
    expect(
      () =>
        new Workspace({ type: 'docker', root: base, programs: ['php cli'] }),
    ).toThrow(UsageError);
  });
});
