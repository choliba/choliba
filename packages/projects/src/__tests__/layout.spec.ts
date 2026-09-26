import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  applyLocations,
  assertProjectExists,
  LocationsError,
  projectHookFile,
  readAppliedLocations,
  REPORT_FOLDER,
  resolveResultsRoot,
  resolveResultsTestFolder,
  TEST_RESULTS_FOLDER,
  listTicketSuffixes,
  projectConfigFile,
  projectEnvExampleFile,
  projectEnvFile,
  projectTestsFolder,
  ProjectsError,
  readJsonFile,
  resolveTestResultsFolder,
  resolveTicketRunsRoot,
  ticketFilePath,
  ticketsFolderPath,
} from '../index';

function withTmpDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-layout-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('project layout', () => {
  it('names the files and folders of a project', () => {
    expect(projectConfigFile('/p/demo')).toBe('/p/demo/config.json');
    expect(projectEnvFile('/p/demo')).toBe('/p/demo/.env.json');
    expect(projectEnvExampleFile('/p/demo')).toBe('/p/demo/.env.example.json');
    expect(projectTestsFolder('/p', 'demo')).toBe('/p/demo/tests');
    expect(projectHookFile('/p', 'demo', 'global-setup')).toBe('/p/demo/global-setup.ts');
    expect(projectHookFile('/p', 'demo', 'global-teardown')).toBe('/p/demo/global-teardown.ts');
    expect(ticketsFolderPath('/p', 'demo')).toBe('/p/demo/tickets');
    expect(ticketFilePath('/p', 'demo', 'T-01')).toBe('/p/demo/tickets/T-01.json');
  });

  it('is a project as soon as config.json exists, with or without .env.json', () => {
    withTmpDir((dir) => {
      expect(() => {
        assertProjectExists(dir, 'nope');
      }).toThrow(`Projeto "nope" não encontrado (${path.join(dir, 'nope', 'config.json')} não existe).`);
      fs.mkdirSync(path.join(dir, 'demo'));
      fs.writeFileSync(path.join(dir, 'demo', 'config.json'), '{}');
      expect(() => {
        assertProjectExists(dir, 'demo');
      }).not.toThrow();
    });
  });
});

describe('listTicketSuffixes', () => {
  it('lists <suffix>.json files only, sorted, and nothing for a missing folder', () => {
    withTmpDir((dir) => {
      fs.writeFileSync(path.join(dir, 'T-02.json'), '{}');
      fs.writeFileSync(path.join(dir, 'T-01.json'), '{}');
      fs.writeFileSync(path.join(dir, 'notes.md'), '');
      fs.mkdirSync(path.join(dir, 'dir.json'));

      expect(listTicketSuffixes(dir)).toEqual(['T-01', 'T-02']);
      expect(listTicketSuffixes(path.join(dir, 'missing'))).toEqual([]);
    });
  });
});

describe('ticket-runs', () => {
  it('uses TICKET_RUNS when set and not blank, PROJECTS_DIR otherwise', () => {
    expect(resolveTicketRunsRoot({ PROJECTS_DIR: '/p', TICKET_RUNS: ' /runs ' })).toBe('/runs');
    expect(resolveTicketRunsRoot({ PROJECTS_DIR: '/p', TICKET_RUNS: '  ' })).toBe('/p');
    expect(resolveTicketRunsRoot({ PROJECTS_DIR: '/p', TICKET_RUNS: undefined })).toBe('/p');
    expect(resolveTicketRunsRoot({ PROJECTS_DIR: '/p' })).toBe('/p');
  });

  it('puts test-results next to the report of a ticket run', () => {
    expect(resolveTestResultsFolder('/runs', 'demo', 'demo-1')).toBe('/runs/demo/ticket-runs/demo-1/test-results');
    expect(resolveTestResultsFolder('/runs', 'demo')).toBe('/runs/demo/ticket-runs/test-results');
  });
});

describe('readJsonFile', () => {
  it('parses a JSON file and names the file when it is invalid', () => {
    withTmpDir((dir) => {
      const good = path.join(dir, 'good.json');
      const bad = path.join(dir, 'bad.json');
      fs.writeFileSync(good, '{"a":1}');
      fs.writeFileSync(bad, '{nope');

      expect(readJsonFile(good)).toEqual({ a: 1 });
      expect(() => readJsonFile(bad)).toThrow(ProjectsError);
      expect(() => readJsonFile(bad)).toThrow(`${bad} não é um JSON válido`);
    });
  });
});

describe('results without a ticket', () => {
  it("prefers _global.resultsDir, then the environment resultsDir, then the project's own runs folder", () => {
    const base = { runsFolder: '/p/demo/ticket-runs' };

    expect(resolveResultsRoot({ ...base, environmentResultsDir: '/env', globalResultsDir: ' /global ' })).toBe(
      '/global',
    );
    expect(resolveResultsRoot({ ...base, environmentResultsDir: ' /env ', globalResultsDir: '  ' })).toBe('/env');
    expect(resolveResultsRoot({ ...base, environmentResultsDir: '', globalResultsDir: undefined })).toBe(
      '/p/demo/ticket-runs',
    );
    expect(resolveResultsRoot(base)).toBe('/p/demo/ticket-runs');
  });

  it('puts test-results inside an absolute root, and the root inside test-results when relative', () => {
    expect(TEST_RESULTS_FOLDER).toBe('test-results');
    expect(REPORT_FOLDER).toBe('playwright-report');
    expect(resolveResultsTestFolder('/g/demo')).toBe('/g/demo/test-results');
    expect(resolveResultsTestFolder('demo')).toBe('test-results/demo');
  });
});

describe('readAppliedLocations', () => {
  it('reads back what applyLocations set, from process.env by default', () => {
    const previous = { ...process.env };
    try {
      applyLocations({ GLOBAL_DIR: '/g', PROJECTS_DIR: '/p', TICKET_RUNS: '/r' });
      expect(readAppliedLocations()).toEqual({ GLOBAL_DIR: '/g', PROJECTS_DIR: '/p', TICKET_RUNS: '/r' });
    } finally {
      process.env = previous;
    }
  });

  it('leaves TICKET_RUNS out when absent and fails when the locations were not applied', () => {
    expect(readAppliedLocations({ GLOBAL_DIR: '/g', PROJECTS_DIR: '/p', TICKET_RUNS: ' ' })).toEqual({
      GLOBAL_DIR: '/g',
      PROJECTS_DIR: '/p',
    });
    expect(() => readAppliedLocations({ GLOBAL_DIR: '/g' })).toThrow(LocationsError);
    expect(() => readAppliedLocations({ PROJECTS_DIR: '/p' })).toThrow(
      'aplique as localizações (applyLocations) antes',
    );
  });
});
