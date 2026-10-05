import type { RunTestsOptions } from './run-tests';

/** The parts of a run specs replace: how Playwright starts, the report prompt, and whether stdin is a terminal. */
export type TestsHooks = Pick<
  RunTestsOptions,
  'spawnPlaywright' | 'promptOpenReport' | 'openHtmlReport' | 'stdinIsTTY'
>;

export const TESTS_HOOKS = Symbol('TESTS_HOOKS');

/** The folder with the runner's Playwright config (`findRunnerRoot`). */
export const RUNNER_ROOT = Symbol('RUNNER_ROOT');
