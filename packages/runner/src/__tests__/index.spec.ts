import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as playwright from '../index';

describe('playwright package entrypoint', () => {
  it('re-exports the public API', () => {
    expect(typeof playwright.flattenResults).toBe('function');
    expect(typeof playwright.isRealFailure).toBe('function');
    expect(typeof playwright.fillTicketTests).toBe('function');
    expect(typeof playwright.runTests).toBe('function');
    expect(playwright.runnerShell.name).toBe('@choliba/runner');
    expect(playwright.testsCommand.name).toBe('tests');
    expect([playwright.RUNNER_ROOT, playwright.TESTS, playwright.TESTS_HOOKS].map(({ name }) => name)).toEqual([
      'RunnerRoot',
      'TestsService',
      'TestsHooks',
    ]);
    expect(playwright.TestsService).toBeDefined();
  });
});

describe('findRunnerRoot', () => {
  it('finds the folder with the Playwright config, from the runner code by default', () => {
    expect(fs.existsSync(path.join(playwright.findRunnerRoot(), 'playwright.config.ts'))).toBe(true);
  });

  it('accepts a built .js config, and fails with none above the start', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-root-'));
    try {
      fs.mkdirSync(path.join(dir, 'bin'));
      fs.writeFileSync(path.join(dir, 'playwright.config.js'), '');
      fs.writeFileSync(path.join(dir, 'bin', 'choliba.js'), '');
      const argv = ['bun', path.join(dir, 'bin', 'choliba.js')];
      expect(playwright.findRunnerRoot(argv, os.tmpdir())).toBe(dir);
      fs.rmSync(path.join(dir, 'playwright.config.js'));
      expect(() => playwright.findRunnerRoot(argv, path.join(dir, 'bin'))).toThrow(
        'Configuração do Playwright do runner',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
