import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { UsageError } from '../src/usage';
import { SandboxPaths } from '../src/workspace/sandbox/path-map';

const paths = new SandboxPaths({
  root: '/home/dev/app/storage/projects/p1',
  home: '/home/dev/app/storage/homes/h1',
  hostHome: '/home/dev',
});

describe('SandboxPaths', () => {
  test('a raiz em /home/choliba; o resto de /home fora de /home', () => {
    expect(paths.agentRoot).toBe('/home/choliba');
    expect(paths.inside('/home/dev/app/storage/projects/p1')).toBe(
      '/home/choliba',
    );
    expect(paths.inside('/home/dev/app/storage/projects/p1/files/a.md')).toBe(
      '/home/choliba/files/a.md',
    );
    // The CLI's home, the user's tools and caches, other homes.
    expect(paths.inside('/home/dev/app/storage/homes/h1/.claude')).toBe(
      '/opt/choliba/home/.claude',
    );
    expect(paths.inside('/home/dev/.bun/bin/bun')).toBe(
      '/opt/choliba/user/.bun/bin/bun',
    );
    expect(paths.inside('/home/outra/.local/bin')).toBe(
      '/opt/choliba/host/outra/.local/bin',
    );
    // A sibling project is not the root: it stays in the user's home.
    expect(paths.inside('/home/dev/app/storage/projects/p10')).toBe(
      '/opt/choliba/user/app/storage/projects/p10',
    );
  });

  test('fora de /home, o caminho não muda', () => {
    expect(paths.inside('/usr/bin/git')).toBe('/usr/bin/git');
    expect(paths.moves('/usr/bin/git')).toBe(false);
    expect(paths.moves('/home/dev/.cache')).toBe(true);
  });

  test('traduz valores: caminho, lista do PATH, nome=valor; texto fica', () => {
    expect(paths.insideValue('/home/dev/.bun/bin:/usr/bin')).toBe(
      '/opt/choliba/user/.bun/bin:/usr/bin',
    );
    expect(paths.insideValue('CODEX_HOME=/home/dev/app/storage/homes/h1')).toBe(
      'CODEX_HOME=/opt/choliba/home',
    );
    expect(paths.insideValue('--settings=/home/dev/x.json')).toBe(
      '--settings=/opt/choliba/user/x.json',
    );
    expect(paths.insideValue('analise /home/dev')).toBe('analise /home/dev');
    expect(paths.insideValue('--print')).toBe('--print');
    expect(
      paths.insideEnv({ HOME: '/home/dev', TOKEN: 'x', VAZIO: undefined }),
    ).toEqual({ HOME: '/opt/choliba/user', TOKEN: 'x' });
  });

  test('withHome troca só o home do CLI', () => {
    const other = paths.withHome('/home/dev/outro-home');
    expect(other.inside('/home/dev/outro-home/.claude')).toBe(
      '/opt/choliba/home/.claude',
    );
    expect(other.inside('/home/dev/app/storage/projects/p1')).toBe(
      '/home/choliba',
    );
  });

  test('o executável num link do home vira o caminho real, visto de dentro', () => {
    const home = mkdtempSync(join(tmpdir(), 'choliba-paths-'));
    try {
      const versions = join(home, '.local/share/cli/versions');
      const bin = join(home, '.local/bin');
      mkdirSync(versions, { recursive: true });
      mkdirSync(bin, { recursive: true });
      writeFileSync(join(versions, '1.0'), '#!/bin/sh\n');
      // Absolute: it points to the host's home, which the sandbox lacks.
      symlinkSync(join(versions, '1.0'), join(bin, 'cli'));
      const local = new SandboxPaths({
        root: join(home, 'app'),
        hostHome: home,
      });

      const command = local.insideCommand(
        { executable: 'cli', arguments: ['--dir', join(home, 'app')] },
        `${bin}:/usr/bin`,
      );
      expect(command.executable).toBe(
        '/opt/choliba/user/.local/share/cli/versions/1.0',
      );
      expect(command.arguments).toEqual(['--dir', '/home/choliba']);
      // `env NAME=value program`: the program too.
      expect(
        local.insideCommand(
          { executable: 'env', arguments: [`X=${home}`, 'cli'] },
          bin,
        ).arguments,
      ).toEqual([
        'X=/opt/choliba/user',
        '/opt/choliba/user/.local/share/cli/versions/1.0',
      ]);
      // Nested: `env A=1 env B=2 program`.
      expect(
        local.insideCommand(
          { executable: 'env', arguments: ['A=1', 'env', 'B=2', 'cli', '-p'] },
          bin,
        ).arguments,
      ).toEqual([
        'A=1',
        'env',
        'B=2',
        '/opt/choliba/user/.local/share/cli/versions/1.0',
        '-p',
      ]);
      // Only assignments: nothing to resolve.
      expect(
        local.insideCommand({ executable: 'env', arguments: ['A=1'] }, bin)
          .arguments,
      ).toEqual(['A=1']);
      // Outside the homes, or not found: as given.
      expect(
        local.insideCommand({ executable: 'sh' }, '/usr/bin').executable,
      ).toBe('sh');
      expect(
        local.insideCommand({ executable: 'nao-existe' }, bin).executable,
      ).toBe('nao-existe');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test('agentRoot é uma pasta direto em /home', () => {
    expect(
      new SandboxPaths({
        root: '/srv/app',
        hostHome: '/home/dev',
        agentRoot: '/home/agente',
      }).inside('/srv/app/x'),
    ).toBe('/home/agente/x');
    for (const agentRoot of ['/srv/choliba', '/home/a/b', '/home', 'home/x']) {
      expect(
        () =>
          new SandboxPaths({
            root: '/srv/app',
            hostHome: '/home/dev',
            agentRoot,
          }),
      ).toThrow(UsageError);
    }
  });
});
