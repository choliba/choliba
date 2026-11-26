import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, expect, test } from 'bun:test';

import {
  clearConfigCache,
  defineConfig,
  loadConfig,
  requireRounds,
} from '../src/config/index';
import { DEFAULT_HOMES_DIR } from '../src/config/constants';
import { UsageError } from '../src/usage';

const defineConfigHref = pathToFileURL(
  resolve(import.meta.dir, '../src/config/index.ts'),
).href;

const originalDebug = process.env['CHOLIBA_DEBUG'];
const originalLogDir = process.env['CHOLIBA_LOG_DIR'];
const originalEnv = process.env['CHOLIBA_ENV'];

function readEnv(name: string): string | undefined {
  return process.env[name];
}

beforeEach(() => {
  clearConfigCache();
  delete process.env['CHOLIBA_DEBUG'];
  delete process.env['CHOLIBA_LOG_DIR'];
  delete process.env['CHOLIBA_ENV'];
});

afterEach(() => {
  clearConfigCache();

  if (originalDebug === undefined) {
    delete process.env['CHOLIBA_DEBUG'];
  } else {
    process.env['CHOLIBA_DEBUG'] = originalDebug;
  }

  if (originalLogDir === undefined) {
    delete process.env['CHOLIBA_LOG_DIR'];
  } else {
    process.env['CHOLIBA_LOG_DIR'] = originalLogDir;
  }

  if (originalEnv === undefined) {
    delete process.env['CHOLIBA_ENV'];
  } else {
    process.env['CHOLIBA_ENV'] = originalEnv;
  }
});

test('defineConfig devolve a configuração', () => {
  const config = defineConfig({
    logger: { dir: 'logs' },
    debug: true,
  });

  expect(config).toEqual({
    logger: { dir: 'logs' },
    debug: true,
  });
});

test('database: diretório e nome configuráveis, padrão próprio em .choliba', async () => {
  const cwds: string[] = [];
  // One directory per config: imports are cached by file and mtime.
  const load = async (config: string) => {
    const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));
    cwds.push(cwd);
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default ${config};\n`,
    );
    clearConfigCache();
    return { cwd, config: loadConfig({ cwd }) };
  };

  try {
    const custom = await load(
      "{ logger: { dir: 'logs' }, database: { dir: 'dados', name: 'agentes.db' } }",
    );
    expect((await custom.config).databasePath).toBe(
      resolve(custom.cwd, 'dados/agentes.db'),
    );

    const nameOnly = await load(
      "{ logger: { dir: 'logs' }, database: { name: 'x.db' } }",
    );
    expect((await nameOnly.config).databasePath).toBe(
      resolve(nameOnly.cwd, '.choliba/x.db'),
    );

    const outside = await load("{ database: { name: '../fora.db' } }");
    await expect(outside.config).rejects.toThrow('database.name');
  } finally {
    for (const cwd of cwds) rmSync(cwd, { recursive: true, force: true });
  }
});

test('opção desconhecida para o carregamento e aponta a certa', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { databasePath: '/x/db' };\n`,
    );
    await expect(loadConfig({ cwd })).rejects.toThrow(
      'Opção desconhecida "databasePath"',
    );
    await expect(loadConfig({ cwd })).rejects.toThrow(
      'database: { dir, name }',
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('logDir antigo aponta para logger.dir', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { logDir: 'logs' };\n`,
    );
    await expect(loadConfig({ cwd })).rejects.toThrow('logger: { dir }');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('logger.use precisa ser uma função', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { logger: { use: {} } };\n`,
    );
    await expect(loadConfig({ cwd })).rejects.toThrow('logger.use');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('o padrão das homes do produto continua .choliba/homes (os testes o trocam no preload)', () => {
  const source = readFileSync(
    resolve(import.meta.dir, '../src/config/constants.ts'),
    'utf8',
  );
  expect(source).toContain(
    `export const DEFAULT_HOMES_DIR = '.choliba/homes';`,
  );
  expect(DEFAULT_HOMES_DIR).not.toBe('.choliba/homes');
});

test('loadConfig usa defaults quando não há arquivo', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    const config = await loadConfig({ cwd });

    expect(config).toEqual({
      logger: {
        dir: resolve(cwd, '.choliba/logs'),
        use: undefined,
        logrotate: undefined,
      },
      databasePath: resolve(cwd, '.choliba/choliba.db'),
      workspaces: {
        dir: resolve(cwd, '.choliba/workspaces'),
        // A temporary folder in the tests (test/support/env.ts).
        homes: resolve(cwd, DEFAULT_HOMES_DIR),
        programs: undefined,
      },
      rounds: {
        dir: undefined,
        definitions: undefined,
        fixtures: undefined,
        data: undefined,
      },
      project: cwd,
      debug: false,
      configPath: undefined,
      env: undefined,
      envs: [],
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig resolve workspaces.dir a partir do arquivo', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { workspaces: { dir: 'storage/workspaces' } };\n`,
    );
    const config = await loadConfig({ cwd });
    expect(config.workspaces.dir).toBe(resolve(cwd, 'storage/workspaces'));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig resolve workspaces.homes e recusa o homes antigo', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { workspaces: { homes: 'storage/homes' } };\n`,
    );
    const config = await loadConfig({ cwd });
    expect(config.workspaces.homes).toBe(resolve(cwd, 'storage/homes'));

    const old = join(cwd, 'antigo');
    mkdirSync(old);
    writeFileSync(
      join(old, 'choliba.config.ts'),
      `export default { homes: { dir: 'storage/homes' } };\n`,
    );
    await expect(loadConfig({ cwd: old })).rejects.toThrow(
      'workspaces: { homes }',
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig recusa uma opção desconhecida em workspaces', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { workspaces: { home: 'storage/homes' } };\n`,
    );
    await expect(loadConfig({ cwd })).rejects.toThrow('workspaces.home');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig recusa uma opção desconhecida em database', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { database: { file: 'x.db' } };\n`,
    );
    await expect(loadConfig({ cwd })).rejects.toThrow(
      'Opção desconhecida "database.file"',
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig recusa um valor de tipo errado em envs', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { envs: [{ A: 'ok', B: { x: 1 } }] };\n`,
    );
    await expect(loadConfig({ cwd })).rejects.toThrow('envs[0].B');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig lê workspaces.programs e recusa o que não é lista de nomes', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { workspaces: { programs: ['php', 'bun'] } };\n`,
    );
    expect((await loadConfig({ cwd })).workspaces.programs).toEqual([
      'php',
      'bun',
    ]);

    for (const programs of [`'php'`, `['php', '']`, `[1]`]) {
      const dir = mkdtempSync(join(cwd, 'invalido-'));
      writeFileSync(
        join(dir, 'choliba.config.ts'),
        `export default { workspaces: { programs: ${programs} } };\n`,
      );
      await expect(loadConfig({ cwd: dir })).rejects.toThrow(
        "deve ser uma lista de nomes de programas, como ['php', 'bun'].",
      );
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig recusa workspaces.dir vazio', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { workspaces: { dir: ' ' } };\n`,
    );
    await expect(loadConfig({ cwd })).rejects.toThrow('workspaces.dir');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

/** A project folder and a sibling outside it, in one temp parent. */
async function withProject(
  run: (paths: {
    readonly parent: string;
    readonly project: string;
  }) => Promise<void>,
): Promise<void> {
  const parent = mkdtempSync(join(tmpdir(), 'choliba-config-'));
  const project = join(parent, 'projeto');
  mkdirSync(project);
  try {
    await run({ parent, project });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

const writeRounds = (project: string, rounds: string): void =>
  writeFileSync(
    join(project, 'choliba.config.ts'),
    `export default { rounds: ${rounds} };\n`,
  );

test('rounds.dir fora do projeto: relativo ao arquivo, ainda sem existir', async () => {
  await withProject(async ({ parent, project }) => {
    writeRounds(project, `{ dir: '../rodadas' }`);
    const config = await loadConfig({ cwd: project });
    expect(config.rounds.dir).toBe(join(parent, 'rodadas'));
  });
});

test('rounds.dir dentro do projeto, igual a ele ou contendo-o é recusado', async () => {
  // One project per case: the loaded config module is cached by file.
  for (const [dir, message] of [
    ['storage/rodadas', 'está dentro do projeto'],
    ['.', 'está dentro do projeto'],
    ['..', 'contém o projeto'],
  ] as const) {
    await withProject(async ({ project }) => {
      writeRounds(project, `{ dir: '${dir}' }`);
      await expect(loadConfig({ cwd: project })).rejects.toThrow(message);
    });
  }
});

test('rounds.dir por um link simbólico que leva para dentro do projeto é recusado', async () => {
  await withProject(async ({ parent, project }) => {
    mkdirSync(join(project, 'storage'));
    symlinkSync(join(project, 'storage'), join(parent, 'atalho'));
    writeRounds(project, `{ dir: '../atalho/rodadas' }`);
    await expect(loadConfig({ cwd: project })).rejects.toThrow(
      'está dentro do projeto',
    );
  });
});

test('rounds: definições, fixtures e registros, relativos ao arquivo', async () => {
  await withProject(async ({ project }) => {
    writeRounds(
      project,
      `{ definitions: 'rodadas/declaradas', data: '../registros' }`,
    );
    const config = await loadConfig({ cwd: project });
    expect(config.rounds.definitions).toBe(join(project, 'rodadas/declaradas'));
    // No default: unset stays unset.
    expect(config.rounds.fixtures).toBeUndefined();
    expect(config.rounds.data).toBe(resolve(project, '../registros'));
    expect(config.project).toBe(project);
  });
});

test('requireRounds devolve as pastas pedidas, absolutas', async () => {
  await withProject(async ({ parent, project }) => {
    writeRounds(
      project,
      `{ dir: '../rodadas', definitions: 'declaradas', fixtures: 'fixtures', data: '../registros' }`,
    );
    await loadConfig({ cwd: project });
    expect(requireRounds('dir').dir).toBe(join(parent, 'rodadas'));
    expect(requireRounds()).toEqual({
      dir: join(parent, 'rodadas'),
      definitions: join(project, 'declaradas'),
      fixtures: join(project, 'fixtures'),
      data: join(parent, 'registros'),
    });
  });
});

test('requireRounds sem as pastas diz quais faltam e onde configurá-las', async () => {
  await withProject(async ({ project }) => {
    writeRounds(project, `{ data: '../registros' }`);
    // The config itself loads without them.
    const config = await loadConfig({ cwd: project });
    expect(config.rounds.dir).toBeUndefined();

    expect(requireRounds('data').data).toBe(resolve(project, '../registros'));
    let message = '';
    try {
      requireRounds('dir', 'data', 'fixtures');
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toContain(join(project, 'choliba.config.ts'));
    expect(message).toContain('rounds.dir');
    expect(message).toContain('CHOLIBA_ROUNDS_DIR');
    expect(message).toContain('rounds.fixtures');
    expect(message).not.toContain('rounds.data');
  });
});

test('rounds: opção desconhecida e dir vazio são recusados', async () => {
  for (const [rounds, message] of [
    [`{ dados: 'x' }`, 'rounds.dados'],
    [`{ dir: ' ' }`, 'rounds.dir'],
    [`{ data: '' }`, 'rounds.data'],
  ] as const) {
    await withProject(async ({ project }) => {
      writeRounds(project, rounds);
      await expect(loadConfig({ cwd: project })).rejects.toThrow(message);
    });
  }
});

test('loadConfig lê choliba.config.ts', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `import { defineConfig } from ${JSON.stringify(defineConfigHref)};

export default defineConfig({
  logger: { dir: 'out/logs' },
  debug: true,
});
`,
    );

    const config = await loadConfig({ cwd });

    expect(config.debug).toBe(true);
    expect(config.logger.dir).toBe(resolve(cwd, 'out/logs'));
    expect(config.configPath).toBe(join(cwd, 'choliba.config.ts'));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig aceita factory assíncrona', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default async () => ({ debug: true, logger: { dir: 'async-logs' } });
`,
    );

    const config = await loadConfig({ cwd });

    expect(config.debug).toBe(true);
    expect(config.logger.dir).toBe(resolve(cwd, 'async-logs'));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig sobe diretórios até achar o arquivo', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));
  const nested = join(cwd, 'agents', 'nested');
  mkdirSync(nested, { recursive: true });

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { debug: true, logger: { dir: 'root-logs' } };
`,
    );

    const config = await loadConfig({ cwd: nested });

    expect(config.debug).toBe(true);
    expect(config.logger.dir).toBe(resolve(cwd, 'root-logs'));
    expect(config.configPath).toBe(join(cwd, 'choliba.config.ts'));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('variáveis CHOLIBA_* têm prioridade sobre o arquivo', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default { debug: false, logger: { dir: 'file-logs' } };
`,
    );
    process.env['CHOLIBA_DEBUG'] = 'true';
    process.env['CHOLIBA_LOG_DIR'] = '/tmp/choliba-env-logs';

    const config = await loadConfig({ cwd });

    expect(config.debug).toBe(true);
    expect(config.logger.dir).toBe('/tmp/choliba-env-logs');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig usa o primeiro env', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default {
  envs: [
    { TOKEN: 'one' },
    { TOKEN: 'two' },
  ],
};
`,
    );

    const config = await loadConfig({ cwd });

    expect(config.env).toEqual({ vars: { TOKEN: 'one' } });
    expect(config.envs).toHaveLength(2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('loadConfig guarda variáveis livres no env', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));
  const originalKey = process.env['CHOLIBA_TEST_FREE_VAR'];

  try {
    delete process.env['CHOLIBA_TEST_FREE_VAR'];
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default {
  envs: [
    {
      CURSOR_API_KEY: 'crsr_test',
      CHOLIBA_TEST_FREE_VAR: 'ok',
      OUTRA: undefined,
    },
  ],
};
`,
    );

    const config = await loadConfig({ cwd });

    expect(config.env).toEqual({
      vars: {
        CURSOR_API_KEY: 'crsr_test',
        CHOLIBA_TEST_FREE_VAR: 'ok',
      },
    });
    expect(readEnv('CHOLIBA_TEST_FREE_VAR')).toBe('ok');
  } finally {
    rmSync(cwd, { recursive: true, force: true });

    if (originalKey === undefined) {
      delete process.env['CHOLIBA_TEST_FREE_VAR'];
    } else {
      process.env['CHOLIBA_TEST_FREE_VAR'] = originalKey;
    }
  }
});

test('loadConfig não sobrescreve process.env já definido', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));
  const originalKey = process.env['CHOLIBA_TEST_FREE_VAR'];

  try {
    process.env['CHOLIBA_TEST_FREE_VAR'] = 'host';
    writeFileSync(
      join(cwd, 'choliba.config.ts'),
      `export default {
  envs: [{ CHOLIBA_TEST_FREE_VAR: 'config' }],
};
`,
    );

    const config = await loadConfig({ cwd });

    expect(config.env?.vars).toEqual({ CHOLIBA_TEST_FREE_VAR: 'config' });
    expect(readEnv('CHOLIBA_TEST_FREE_VAR')).toBe('host');
  } finally {
    rmSync(cwd, { recursive: true, force: true });

    if (originalKey === undefined) {
      delete process.env['CHOLIBA_TEST_FREE_VAR'];
    } else {
      process.env['CHOLIBA_TEST_FREE_VAR'] = originalKey;
    }
  }
});

test('loadConfig rejeita default inválido', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'choliba-config-'));

  try {
    writeFileSync(join(cwd, 'choliba.config.ts'), `export default 'nope';\n`);

    await expect(loadConfig({ cwd })).rejects.toBeInstanceOf(UsageError);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
