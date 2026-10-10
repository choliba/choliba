import { token } from '@choliba/core';

import type { TestsHooks, TestsService } from './tests.service';

/** What specs replace in a run (see `TestsHooks`); nothing in the app. */
export const TESTS_HOOKS = token<TestsHooks>('TestsHooks');

/** The folder with the runner's Playwright config (`findRunnerRoot`). */
export const RUNNER_ROOT = token<string>('RunnerRoot');

/** What runs `choliba tests`. */
export const TESTS = token<TestsService>('TestsService');
