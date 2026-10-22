import { PLATFORM, THEME, WORKSPACE_ROOT, type ShellModule } from '@choliba/core';

import { findRunnerRoot } from './runner-root';
import { RUNNER_ROOT, TESTS, TESTS_HOOKS } from './tests.constants';
import { TestsService } from './tests.service';

/** @choliba/runner's service registrations used by the app-owned tests command. */
export const runnerShell: ShellModule = {
  name: '@choliba/runner',
  provide: (container) => {
    // Called without arguments: the running script and this file are where it looks from.
    container.provide(RUNNER_ROOT, () => findRunnerRoot());
    container.provide(TESTS_HOOKS, () => ({}));
    container.provide(
      TESTS,
      (c) =>
        new TestsService(
          () => c.get(WORKSPACE_ROOT),
          () => c.get(RUNNER_ROOT),
          c.get(PLATFORM),
          c.get(TESTS_HOOKS),
          c.get(THEME),
        ),
    );
  },
  commands: [],
};
