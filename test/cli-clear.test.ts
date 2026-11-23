import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { clearCommand } from '../src/cli/clear';
import { clearConfigCache } from '../src/config/index';
import type { Interaction } from '../src/interaction/index';

let cwd: string;
/** rounds.dir must be outside the project: a folder of its own. */
let roundsDir: string;

beforeEach(() => {
  clearConfigCache();
  cwd = mkdtempSync(join(tmpdir(), 'choliba-clear-'));
  roundsDir = mkdtempSync(join(tmpdir(), 'choliba-clear-rounds-'));
});

afterEach(() => {
  clearConfigCache();
  rmSync(cwd, { recursive: true, force: true });
  rmSync(roundsDir, { recursive: true, force: true });
});

interface Folders {
  readonly logs?: string;
  readonly workspaces?: string;
  readonly homes?: string;
  readonly rounds?: string;
}

const all = (): Required<Folders> => ({
  logs: 'logs',
  workspaces: 'workspaces',
  homes: 'homes',
  rounds: roundsDir,
});

/** A choliba.config.ts in `cwd` pointing at `folders`, relative to it. */
function configure(folders: Folders): void {
  const config = {
    ...(folders.logs === undefined ? {} : { logger: { dir: folders.logs } }),
    workspaces: {
      ...(folders.workspaces === undefined ? {} : { dir: folders.workspaces }),
      ...(folders.homes === undefined ? {} : { homes: folders.homes }),
    },
    ...(folders.rounds === undefined
      ? {}
      : { rounds: { dir: folders.rounds } }),
  };
  writeFileSync(
    join(cwd, 'choliba.config.ts'),
    `export default ${JSON.stringify(config)};\n`,
  );
}

/** Creates `names` inside `folder`, relative to `cwd`. */
function fill(folder: string, ...names: string[]): void {
  mkdirSync(resolve(cwd, folder), { recursive: true });
  for (const name of names) writeFileSync(resolve(cwd, folder, name), name);
}

function entries(folder: string): string[] {
  return readdirSync(resolve(cwd, folder)).toSorted();
}

/** Runs `choliba clear argv` in `cwd`, answering `answer` when asked. */
async function clear(
  argv: string[],
  answer = '',
): Promise<{ written: string; asked: number; failed: boolean }> {
  const lines: string[] = [];
  let asked = 0;
  let failed = false;
  const output: Interaction = {
    ask: () => {
      asked += 1;
      return Promise.resolve(answer);
    },
    write: (value) => lines.push(value),
  };
  await clearCommand(argv, {
    output,
    config: { cwd },
    onFailure: () => {
      failed = true;
    },
  });
  return { written: lines.join('\n'), asked, failed };
}

describe('choliba clear', () => {
  test('sem opção diz o que apagar e falha', async () => {
    configure(all());

    const result = await clear([]);

    expect(result.failed).toBe(true);
    expect(result.written).toContain(
      'Diga o que apagar: --logs, --workspaces, --homes, --rounds ou --all.',
    );
  });

  test('pastas vazias ou inexistentes: nada a apagar', async () => {
    configure(all());
    fill('workspaces');

    const result = await clear(['--workspaces', '--homes']);

    expect(result.written).toBe(
      `Nada a apagar em ${join(cwd, 'workspaces')}, ${join(cwd, 'homes')}.`,
    );
    expect(result.asked).toBe(0);
  });

  test('--dry lista e não apaga', async () => {
    configure(all());
    fill('workspaces', 'a', 'b');

    const result = await clear(['--workspaces', '--dry']);

    // The folder's order is the disk's: the items are compared sorted.
    const [title, ...items] = result.written.split('\n');
    expect(title).toBe(`${join(cwd, 'workspaces')}:`);
    expect(items.toSorted()).toEqual(['  a', '  b']);
    expect(result.asked).toBe(0);
    expect(entries('workspaces')).toEqual(['a', 'b']);
  });

  test('--all --yes esvazia as quatro pastas e as mantém', async () => {
    configure(all());
    fill('logs', 'antigo.jsonl');
    fill('workspaces', 'w');
    fill('homes', 'h');
    fill(roundsDir, 'r');

    const result = await clear(['--all', '--yes']);

    expect(result.asked).toBe(0);
    expect(result.written).toMatch(/\d+ item\(ns\) apagado\(s\)\.$/);
    for (const folder of ['workspaces', 'homes', roundsDir]) {
      expect(entries(folder)).toEqual([]);
    }
    expect(entries('logs')).not.toContain('antigo.jsonl');
  });

  test('sem --yes pergunta: "n" não apaga, "s" apaga', async () => {
    configure(all());
    fill('homes', 'h1', 'h2');

    const kept = await clear(['--homes'], 'n');

    expect(kept.asked).toBe(1);
    expect(kept.written).toContain('Apagar 2 item(ns)? [s/N]');
    expect(kept.written).toEndWith('Nada foi apagado.');
    expect(entries('homes')).toEqual(['h1', 'h2']);

    clearConfigCache();
    const removed = await clear(['-H'], ' S ');

    expect(removed.written).toEndWith('2 item(ns) apagado(s).');
    expect(entries('homes')).toEqual([]);
  });

  test('duas opções na mesma pasta: ela aparece uma vez', async () => {
    configure({ workspaces: 'mesma', homes: 'mesma' });
    fill('mesma', 'x');

    const result = await clear(['-w', '-H', '-d']);

    expect(result.written).toBe(`${join(cwd, 'mesma')}:\n  x`);
  });

  test('--all sem rounds.dir apaga o resto', async () => {
    // homes explícito: sem ele vale o home padrão dos testes, que outros testes já encheram.
    configure({ workspaces: 'workspaces', homes: 'homes' });
    fill('workspaces', 'w');

    const result = await clear(['--all', '--dry']);

    expect(result.written).toBe(`${join(cwd, 'workspaces')}:\n  w`);
  });

  test('--rounds sem rounds.dir diz como configurar', async () => {
    configure({ workspaces: 'workspaces' });

    const result = await clear(['--rounds']);

    expect(result.failed).toBe(true);
    expect(result.written).toContain('rounds.dir');
  });
});
