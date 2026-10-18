import fs from 'node:fs';
import path from 'node:path';

import { isRealFailure } from './playwright-results';
import { criterionRuns, type CriterionTest, type PlaywrightReport } from './ticket-verdict';

/** How one test went, in a ticket's last run. */
export interface TestResult {
  /** The test's own title, without the spec file and the suites before it. */
  readonly title: string;
  /** The spec file it is in, relative to `tests/`. */
  readonly file: string;
  readonly status: 'passed' | 'failed' | 'skipped' | 'flaky';
  /** The device (Playwright project) it ran on. */
  readonly device?: string;
  /** Its error, without the colors, when it failed. */
  readonly error?: string;
}

/** Where a criterion stands after the last run: no test, every test passed, one failed, or none of them ran. */
export type CriterionStatus = 'sem teste' | 'passou' | 'falhou' | 'não rodou';

/** A ticket's last run, from the report `choliba run tests` leaves. */
export interface TicketResults {
  /** When the run started, as Playwright says it (ISO 8601). */
  readonly ranAt: string;
  /** How long it took, in milliseconds. */
  readonly duration: number;
  readonly stats: {
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
    readonly flaky: number;
  };
  readonly tests: readonly TestResult[];
  readonly criteria: readonly { readonly id: string; readonly status: CriterionStatus }[];
}

/** The report's file in `reportFolder`. */
export function reportFile(reportFolder: string): string {
  return path.join(reportFolder, 'results.json');
}

/** The Playwright report in `reportFolder`, or nothing when the run left none. */
export function readReport(reportFolder: string): PlaywrightReport | undefined {
  const file = reportFile(reportFolder);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as PlaywrightReport) : undefined;
}

/** Playwright's words for a test's outcome, as a script reads them. */
const STATUS: Readonly<Record<string, TestResult['status']>> = {
  expected: 'passed',
  unexpected: 'failed',
  skipped: 'skipped',
  flaky: 'flaky',
};

/** Counts of a report with no `stats`: Playwright always writes them; a hand-made report may not. */
const NO_STATS = { startTime: '', duration: 0, expected: 0, unexpected: 0, skipped: 0, flaky: 0 };

/** A test as a script reads it: its full title is `<file> › <suites…> › <title>`. */
function testResult(test: CriterionTest): TestResult {
  return {
    title: test.title.replace(/^.* › /, ''),
    file: test.title.replace(/ › .*$/, ''),
    status: STATUS[test.status] ?? 'failed',
    ...(test.device === undefined ? {} : { device: test.device }),
    ...(test.error === undefined ? {} : { error: test.error }),
  };
}

function criterionStatus(tests: readonly CriterionTest[]): CriterionStatus {
  if (tests.length === 0) return 'sem teste';
  if (tests.some((test) => isRealFailure(test.status))) return 'falhou';
  return tests.every((test) => test.status === 'skipped') ? 'não rodou' : 'passou';
}

/**
 * A ticket's last run, read from the report in `reportFolder` with the ticket's `criteria`: when, how long, how
 * many tests passed and failed, each test, and where each criterion stands. Nothing when the ticket never ran.
 */
export function ticketResults(
  reportFolder: string,
  criteria: readonly { readonly id: string }[],
): TicketResults | undefined {
  const report = readReport(reportFolder);
  if (report === undefined) return undefined;
  const runs = criterionRuns({ criterios: criteria }, report);
  const stats = report.stats ?? NO_STATS;
  return {
    ranAt: stats.startTime,
    duration: stats.duration,
    stats: { passed: stats.expected, failed: stats.unexpected, skipped: stats.skipped, flaky: stats.flaky },
    tests: runs.flatMap((run) => run.tests).map(testResult),
    criteria: runs.map((run) => ({ id: run.id, status: criterionStatus(run.tests) })),
  };
}
