import { fakePlatform } from '@choliba/kernel/testing';

import { CHOLIBA_SHELL, cholibaShell, createCholibaShell, type Runtime } from '../index';
import { RUNTIME } from '../runtime';
import { fakeRuntime } from './helpers/runtime';

describe('the package root', () => {
  it('exports the shell and does not run it', () => {
    const runtime: Runtime = fakeRuntime();

    expect(process.exitCode).toBeUndefined();
    expect(CHOLIBA_SHELL.map((module) => module.name)).toEqual([
      '@choliba/shell',
      '@choliba/tui',
      'choliba-agents-panel',
      '@choliba/agents',
      'choliba-agents-commands',
      '@choliba/projects',
      'choliba-projects-commands',
      '@choliba/runner',
      'choliba-tests-commands',
    ]);
    expect(cholibaShell(runtime).name).toBe('choliba');
    expect(createCholibaShell(fakePlatform(), runtime).container.get(RUNTIME)).toBe(runtime);
  });
});
