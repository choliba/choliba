import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ExpectedError } from '@choliba/core';

import {
  listProjectNames,
  loadProjectSettings,
  projectHookFile,
  projectOfArgument,
  readJsonFile,
  resolveResultsRoot,
  resolveResultsTestFolder,
  resolveTestResultsFolder,
  TEST_RESULTS_FOLDER,
} from '../../app';

const ENV = {
  nome: 'development',
  baseURL: 'http://localhost:5173/',
  appDir: '/code/app',
  start: 'bun run dev',
  setup: ['bun install'],
  default: true,
};

function withProject(config: unknown, env: unknown, fn: (projectsDir: string, projectPath: string) => void): void {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-project-'));
  const projectPath = path.join(projectsDir, 'demo');
  try {
    fs.mkdirSync(projectPath);
    fs.writeFileSync(path.join(projectPath, 'config.json'), JSON.stringify({ name: 'Demo', ...(config as object) }));
    if (env !== undefined) {
      fs.writeFileSync(path.join(projectPath, '.env.json'), JSON.stringify(env));
    }
    fn(projectsDir, projectPath);
  } finally {
    fs.rmSync(projectsDir, { recursive: true, force: true });
  }
}

describe('loadProjectSettings', () => {
  it('reads credentials, globals and an absolute APP_DIR', () => {
    withProject({ envs: [ENV] }, { development: { USER: 'ana' }, _global: { WORKER: 'TRUE' } }, (projectsDir) => {
      const settings = loadProjectSettings(projectsDir, 'demo');
      expect(settings.env['USER']).toBe('ana');
      expect(settings.env['WORKER']).toBe('TRUE');
      expect(settings.appDir).toBe(path.resolve(path.join(projectsDir, 'demo'), ENV.appDir));
      expect(listProjectNames(projectsDir)).toEqual(['demo']);
    });
  });

  it('fails when the project, env file, environment or JSON is wrong', () => {
    const missing = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-missing-'));
    try {
      expect(() => loadProjectSettings(missing, 'demo')).toThrow(ExpectedError);
      expect(() => loadProjectSettings(missing, 'demo')).toThrow('não encontrado');
    } finally {
      fs.rmSync(missing, { recursive: true, force: true });
    }
    withProject({ envs: [ENV] }, undefined, (projectsDir, projectPath) => {
      expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow(
        `${path.join(projectPath, '.env.json')}: não existe — crie a partir de ${path.join(projectPath, '.env.example.json')} e troque os CHANGE_ME.`,
      );
    });
    withProject({ envs: [ENV], environment: 'prod' }, { development: {} }, (projectsDir) => {
      expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow('o ambiente "prod" não existe');
    });
    withProject({ envs: [ENV] }, { other: {} }, (projectsDir) => {
      expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow('falta a seção do ambiente "development"');
    });
    withProject({ envs: [ENV] }, { development: {} }, (projectsDir, projectPath) => {
      fs.writeFileSync(path.join(projectPath, 'config.json'), '[]');
      expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow('o conteúdo precisa ser um objeto JSON');
      fs.writeFileSync(path.join(projectPath, 'config.json'), '{');
      expect(() => loadProjectSettings(projectsDir, 'demo')).toThrow('não é um JSON válido');
      expect(() => readJsonFile(path.join(projectPath, 'config.json'))).toThrow(ExpectedError);
    });
  });
});

describe('projectOfArgument and hooks', () => {
  const projectsDir = path.join(path.sep, 'work', 'projects');
  const names = ['site', 'site-choliba'];

  it('names a project by its folder, never by a part of the name', () => {
    expect(
      projectOfArgument(projectsDir, names, path.join(projectsDir, 'site-choliba', 'tests', 'a.spec.ts'), '/'),
    ).toBe('site-choliba');
    expect(projectOfArgument(projectsDir, names, 'site-choliba/tests/a.spec.ts', '/runner')).toBe('site-choliba');
    expect(projectOfArgument(projectsDir, names, path.join(path.sep, 'elsewhere', 'site', 'a.spec.ts'), '/')).toBe(
      undefined,
    );
    expect(projectHookFile('/p', 'demo', 'global-setup')).toBe(path.join('/p', 'demo', 'global-setup.ts'));
  });
});

describe('results folders', () => {
  const base = { runsFolder: '/p/demo/ticket-runs' };

  it('prefers global, then environment, then the runs folder', () => {
    expect(resolveResultsRoot({ ...base, environmentResultsDir: '/env', globalResultsDir: ' /global ' })).toBe(
      '/global',
    );
    expect(resolveResultsRoot({ ...base, environmentResultsDir: ' /env ', globalResultsDir: '  ' })).toBe('/env');
    expect(resolveResultsRoot({ ...base, environmentResultsDir: '', globalResultsDir: undefined })).toBe(
      '/p/demo/ticket-runs',
    );
    expect(resolveResultsRoot(base)).toBe('/p/demo/ticket-runs');
    expect(resolveResultsTestFolder('/abs')).toBe(path.join('/abs', TEST_RESULTS_FOLDER));
    expect(resolveResultsTestFolder('rel')).toBe(path.join(TEST_RESULTS_FOLDER, 'rel'));
    expect(resolveTestResultsFolder('/runs', 'demo', 'demo-1')).toBe(
      path.join('/runs', 'demo', 'ticket-runs', 'demo-1', TEST_RESULTS_FOLDER),
    );
  });
});
