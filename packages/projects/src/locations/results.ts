import path from 'node:path';

/** Folder Playwright writes test output to, inside a results root or a ticket run. */
export const TEST_RESULTS_FOLDER = 'test-results';

/** Folder of Playwright's HTML report, inside a ticket run or, by default, the run's working dir. */
export const REPORT_FOLDER = 'playwright-report';

/** What decides where a run without a ticket leaves its artifacts. Blank values count as absent. */
export interface ResultsRootSources {
  /** The project's runs folder (`resolveTicketRunsFolder` without a ticket), where its ticket runs go too. */
  readonly runsFolder: string;
  /** `resultsDir` of the active environment, from the project's `config.json`. */
  readonly environmentResultsDir?: string | undefined;
  /** `_global.resultsDir`, from the project's `.env.json`. */
  readonly globalResultsDir?: string | undefined;
}

function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * Where a run without a ticket leaves its artifacts: `.env.json`'s `_global.resultsDir`, else the active
 * environment's `resultsDir` in `config.json`, else the project's runs folder, next to its ticket runs.
 */
export function resolveResultsRoot(sources: ResultsRootSources): string {
  return present(sources.globalResultsDir) ?? present(sources.environmentResultsDir) ?? sources.runsFolder;
}

/** `test-results` inside an absolute results root, or `test-results/<root>` for a relative one. */
export function resolveResultsTestFolder(resultsRoot: string): string {
  return path.isAbsolute(resultsRoot)
    ? path.join(resultsRoot, TEST_RESULTS_FOLDER)
    : path.join(TEST_RESULTS_FOLDER, resultsRoot);
}
