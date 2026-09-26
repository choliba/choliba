import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadProjectSettings,
  PLACEHOLDER_VALUE,
  ProjectsError,
  selectEnvironment,
  type ProjectEnvironment,
} from '../index';

const ENV = { nome: 'development', baseURL: 'http://localhost:5173/', appDir: '/code/app', default: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withProject(config: unknown, env: unknown, fn: (projectsDir: string, projectPath: string) => void): void {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-settings-'));
  const projectPath = path.join(projectsDir, 'demo');
  try {
    fs.mkdirSync(projectPath);
    // Every case gets a `name` unless it says otherwise (a key present, even `undefined`, is kept as given).
    const named = isRecord(config) && !('name' in config) ? { name: 'Demo', ...config } : config;
    fs.writeFileSync(path.join(projectPath, 'config.json'), JSON.stringify(named));
    if (env !== undefined) {
      fs.writeFileSync(path.join(projectPath, '.env.json'), JSON.stringify(env));
    }
    fn(projectsDir, projectPath);
  } finally {
    fs.rmSync(projectsDir, { recursive: true, force: true });
  }
}

function expectFailure(config: unknown, env: unknown, message: string): void {
  withProject(config, env, (projectsDir) => {
    expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow(ProjectsError);
    expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow(message);
  });
}

describe('loadProjectSettings', () => {
  it('reads the active environment, its credentials and _global, with APP_DIR absolute', () => {
    withProject(
      { envs: [{ ...ENV, resultsDir: '/r' }], devices: { chromium: true } },
      { development: { TEST_USERNAME: 'ana', TEST_PASSWORD: 's3cret' }, _global: { WORKER: 'TRUE' } },
      (projectsDir, projectPath) => {
        expect(loadProjectSettings(projectsDir, 'demo')).toEqual({
          project: 'demo',
          projectPath,
          config: { name: 'Demo', envs: [{ ...ENV, resultsDir: '/r' }], devices: { chromium: true } },
          environment: { ...ENV, resultsDir: '/r' },
          appDir: '/code/app',
          credentials: { TEST_USERNAME: 'ana', TEST_PASSWORD: 's3cret' },
          globals: { WORKER: 'TRUE' },
          env: {
            BASE_URL: 'http://localhost:5173/',
            APP_DIR: '/code/app',
            TEST_USERNAME: 'ana',
            TEST_PASSWORD: 's3cret',
            WORKER: 'TRUE',
          },
        });
      },
    );
  });

  it('resolves a relative appDir from the project folder, and honors a fixed environment', () => {
    const envs = [
      { nome: 'development', baseURL: 'http://dev/', appDir: '../app' },
      { nome: 'staging', baseURL: 'http://stg/', appDir: 'code', default: false },
    ];
    withProject({ envs, environment: 'staging' }, { staging: {} }, (projectsDir, projectPath) => {
      const settings = loadProjectSettings(projectsDir, 'demo');

      expect(settings.environment.nome).toBe('staging');
      expect(settings.appDir).toBe(path.join(projectPath, 'code'));
      expect(settings.globals).toEqual({});
    });
  });

  it('refuses a project while anything it uses still says CHANGE_ME, listing every field', () => {
    const config = {
      name: PLACEHOLDER_VALUE,
      envs: [{ ...ENV, baseURL: PLACEHOLDER_VALUE, appDir: ` ${PLACEHOLDER_VALUE} ` }],
    };
    withProject(
      config,
      { development: { TEST_USERNAME: 'ana', TEST_PASSWORD: PLACEHOLDER_VALUE }, _global: { X: PLACEHOLDER_VALUE } },
      (projectsDir, projectPath) => {
        const configFile = path.join(projectPath, 'config.json');
        const envFile = path.join(projectPath, '.env.json');
        expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow(
          `Projeto "demo" ainda não foi configurado — troque CHANGE_ME em: ` +
            `${configFile} config.name, ${configFile} envs[development].baseURL, ${configFile} envs[development].appDir, ` +
            `${envFile} development.TEST_PASSWORD, ${envFile} _global.X.`,
        );
      },
    );
  });

  it('only checks the active environment for CHANGE_ME', () => {
    const envs = [ENV, { nome: 'staging', baseURL: PLACEHOLDER_VALUE, appDir: PLACEHOLDER_VALUE }];
    withProject({ envs }, { development: {}, staging: { TEST_USERNAME: PLACEHOLDER_VALUE } }, (projectsDir) => {
      expect(loadProjectSettings(projectsDir, 'demo').environment.nome).toBe('development');
    });
  });

  it('keeps an optional description', () => {
    withProject({ envs: [ENV], description: 'Loja de testes' }, { development: {} }, (projectsDir) => {
      expect(loadProjectSettings(projectsDir, 'demo').config.description).toBe('Loja de testes');
    });
  });

  it('asks for .env.json, pointing at .env.example.json, when only config.json exists', () => {
    withProject({ envs: [ENV] }, undefined, (projectsDir, projectPath) => {
      expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow(
        `${path.join(projectPath, '.env.json')}: não existe — crie a partir de ${path.join(projectPath, '.env.example.json')} e troque os CHANGE_ME.`,
      );
    });
  });

  it('fails when the project is missing a file', () => {
    const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-settings-missing-'));
    try {
      expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow('Projeto "demo" não encontrado');
    } finally {
      fs.rmSync(projectsDir, { recursive: true, force: true });
    }
  });

  it.each([
    ['config.json is not an object', [], {}, 'o conteúdo precisa ser um objeto JSON'],
    ['no name', { name: undefined, envs: [ENV] }, {}, 'config.name é obrigatório'],
    ['a blank name', { name: ' ', envs: [ENV] }, {}, 'config.name é obrigatório'],
    ['a description that is not text', { envs: [ENV], description: 1 }, {}, 'config.description precisa ser texto'],
    ['no envs', {}, {}, 'nenhum ambiente definido'],
    ['empty envs', { envs: [] }, {}, 'nenhum ambiente definido'],
    ['an env that is not an object', { envs: ['x'] }, {}, 'envs[0] precisa ser um objeto'],
    ['an env without nome', { envs: [{ baseURL: 'u', appDir: 'a' }] }, {}, 'envs[0].nome é obrigatório'],
    ['_global as an env name', { envs: [{ ...ENV, nome: '_global' }] }, {}, '"_global" é reservado'],
    ['an env without baseURL', { envs: [{ nome: 'd', appDir: 'a' }] }, {}, 'envs[d].baseURL é obrigatório'],
    [
      'an env with a blank appDir',
      { envs: [{ nome: 'd', baseURL: 'u', appDir: ' ' }] },
      {},
      'envs[d].appDir é obrigatório',
    ],
    [
      'an unknown fixed environment',
      { envs: [ENV], environment: 'prod' },
      {},
      'o ambiente "prod" não existe em envs (disponíveis: development)',
    ],
    ['.env.json without the environment', { envs: [ENV] }, { other: {} }, 'falta a seção do ambiente "development"'],
    [
      'an environment section that is not an object',
      { envs: [ENV] },
      { development: 'x' },
      '"development" precisa ser um objeto de textos',
    ],
    ['a credential that is not text', { envs: [ENV] }, { development: { N: 1 } }, 'development.N precisa ser texto'],
    [
      'a _global that is not an object',
      { envs: [ENV] },
      { development: {}, _global: [] },
      '"_global" precisa ser um objeto de textos',
    ],
  ])('fails on %s', (_label, config, env, message) => {
    expectFailure(config, env, message);
  });
});

describe('selectEnvironment', () => {
  const first: ProjectEnvironment = { nome: 'a', baseURL: 'u', appDir: 'x' };
  const envs: ProjectEnvironment[] = [first, { nome: 'b', baseURL: 'u', appDir: 'x', default: true }];

  it('takes the fixed one, then the default, then the first', () => {
    expect(selectEnvironment(envs, 'a')?.nome).toBe('a');
    expect(selectEnvironment(envs)?.nome).toBe('b');
    expect(selectEnvironment([first])?.nome).toBe('a');
    expect(selectEnvironment(envs, 'zzz')).toBeUndefined();
    expect(selectEnvironment([])).toBeUndefined();
  });
});
