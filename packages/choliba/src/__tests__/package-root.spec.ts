import { fakePlatform } from '@choliba/core/testing';

import { CHOLIBA_SHELL, cholibaShell, createCholibaShell, type Runtime } from '../index';
import { RUNTIME } from '../runtime';
import { fakeRuntime } from './helpers/runtime';

describe('the package root', () => {
  it('exports the shell and does not run it', () => {
    const runtime: Runtime = fakeRuntime();

    expect(process.exitCode).toBeUndefined();
    expect(CHOLIBA_SHELL.map((module) => module.name)).toEqual([
      '@choliba/core',
      '@choliba/tui',
      '@choliba/agents',
      '@choliba/projects',
      '@choliba/runner',
    ]);
    expect(cholibaShell(runtime).name).toBe('choliba');
    expect(createCholibaShell(fakePlatform(), runtime).container.get(RUNTIME)).toBe(runtime);
  });
});
