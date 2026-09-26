import { flattenResults, isRealFailure, type FlatTestResult } from './playwright-results';

/** What a ticket's tests must show: `red` (all fail, on the behavior) or `green` (all pass). */
export type Expectation = 'red' | 'green';

export const EXPECTATIONS: readonly Expectation[] = ['red', 'green'];

/** The parts of Playwright's JSON report read here. */
export interface PlaywrightReport {
  readonly suites?: Parameters<typeof flattenResults>[0];
  /** Errors outside any test: a spec that does not compile or import. */
  readonly errors?: readonly { readonly message?: string }[];
}

export interface TicketCriteria {
  readonly criterios?: readonly { readonly id: string }[];
}

export interface CriterionTest {
  readonly title: string;
  readonly status: string;
  readonly error?: string;
}

/** A criterion and the tests whose title starts with `<id>:`. */
export interface CriterionRun {
  readonly id: string;
  readonly tests: readonly CriterionTest[];
}

const PASSED = ['expected', 'flaky'];

/** A failure of the test's own code (a typo, a wrong import), not of the behavior it checks. */
const BROKEN_TEST = /^(ReferenceError|TypeError|SyntaxError)\b/;

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

function lastError(results: readonly unknown[]): string | undefined {
  const last = results.at(-1) as { error?: { message?: string } } | undefined;
  return last?.error?.message?.replaceAll(ANSI, '');
}

function toCriterionTest(row: FlatTestResult): CriterionTest {
  const error = lastError(row.results);
  return error === undefined
    ? { title: row.fullTitle, status: row.status }
    : { title: row.fullTitle, status: row.status, error };
}

export function criterionRuns(ticket: TicketCriteria, report: PlaywrightReport): readonly CriterionRun[] {
  const rows = flattenResults([...(report.suites ?? [])]);
  return (ticket.criterios ?? []).map(({ id }) => ({
    id,
    tests: rows.filter((row) => row.fullTitle.split(' › ').pop()?.startsWith(`${id}:`)).map(toCriterionTest),
  }));
}

function redProblem(test: CriterionTest): string | undefined {
  if (PASSED.includes(test.status)) return `já passa (o comportamento já existe?): ${test.title}`;
  if (!isRealFailure(test.status)) return `teste pulado: ${test.title}`;
  if (test.error !== undefined && BROKEN_TEST.test(test.error)) {
    return `o teste quebra no próprio código, não no comportamento: ${test.error}`;
  }
  return undefined;
}

function greenProblem(test: CriterionTest): string | undefined {
  if (PASSED.includes(test.status)) return undefined;
  return `ainda falha: ${test.title}${test.error === undefined ? '' : `: ${test.error}`}`;
}

function runProblems(expectation: Expectation, run: CriterionRun): readonly string[] {
  if (run.tests.length === 0) {
    return [`${run.id}: nenhum teste (o título precisa começar com "${run.id}:")`];
  }
  const problemOf = expectation === 'red' ? redProblem : greenProblem;
  return run.tests.flatMap((test) => {
    const problem = problemOf(test);
    return problem === undefined ? [] : [`${run.id}: ${problem}`];
  });
}

/**
 * Why the ticket's tests do not show `expectation`; empty when they do. Red: every criterion has a
 * test and every one of them fails on the behavior. Green: every criterion has a test and all pass.
 */
export function verdictProblems(
  expectation: Expectation,
  ticket: TicketCriteria,
  report: PlaywrightReport,
): readonly string[] {
  const loadErrors = (report.errors ?? []).map((error) => `o spec não carregou: ${error.message ?? ''}`);
  if (loadErrors.length > 0) return loadErrors;
  if ((ticket.criterios ?? []).length === 0) return ['o ticket não tem critérios'];
  return criterionRuns(ticket, report).flatMap((run) => runProblems(expectation, run));
}

function formatTest(test: CriterionTest): readonly string[] {
  const line = `- ${test.title} (${test.status})`;
  if (test.error === undefined) return [line, ''];
  const error = test.error.split('\n').map((text) => `  ${text}`);
  return [line, '', '  ```', ...error, '  ```', ''];
}

/** The tests of each criterion and how they failed, in Markdown: what the green phase implements from. */
export function formatFailures(ticket: string, runs: readonly CriterionRun[]): string {
  const sections = runs.flatMap((run) => [
    `## ${run.id}`,
    '',
    ...(run.tests.length === 0 ? ['- nenhum teste', ''] : run.tests.flatMap(formatTest)),
  ]);
  return [`# Falhas do ticket ${ticket}`, '', ...sections].join('\n');
}
