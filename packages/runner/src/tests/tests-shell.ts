import { PLATFORM, THEME, WORKSPACE_ROOT, type ShellModule } from '@choliba/core';
import { projectsConfig } from '@choliba/workspace';

import { findRunnerRoot } from './runner-root';
import { testsCommand } from './tests.command';
import { RUNNER_ROOT, TESTS, TESTS_HOOKS } from './tests.constants';
import { TestsService } from './tests.service';

/** @choliba/runner in the shell: `choliba run tests`. The runner's folder is looked for only when the tests run. */
export const runnerShell: ShellModule = {
  name: '@choliba/runner',
  config: [projectsConfig],
  provide: (container) => {
    // Called without arguments: the running script and this file are where it looks from.
    container.provide(RUNNER_ROOT, () => findRunnerRoot());
    container.provide(TESTS_HOOKS, () => ({}));
    container.provide(
      TESTS,
      (c) =>
        new TestsService(
          () => c.get(WORKSPACE_ROOT),
          c.get(projectsConfig.token),
          () => c.get(RUNNER_ROOT),
          c.get(PLATFORM),
          c.get(TESTS_HOOKS),
          c.get(THEME),
        ),
    );
  },
  commands: [testsCommand],
};
