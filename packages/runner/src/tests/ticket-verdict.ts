import { flattenResults, isRealFailure, type FlatTestResult } from './playwright-results';

/**
 * What a ticket's tests must show: `red` (something to implement: at least one fails on the behavior, and the
 * ones that pass are criteria the application already meets) or `green` (all pass).
 */
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
  /** The device (Playwright project) it ran on: the same test runs once per device. */
  readonly device?: string;
  /** The `trace.zip` its last run kept (the config keeps one per failed test). */
  readonly trace?: string;
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

interface RunResult {
  readonly error?: { readonly message?: string };
  readonly attachments?: readonly { readonly name?: string; readonly path?: string }[];
}

function toCriterionTest(row: FlatTestResult): CriterionTest {
  const last = row.results.at(-1) as RunResult | undefined;
  const error = last?.error?.message?.replaceAll(ANSI, '');
  const trace = last?.attachments?.find((attachment) => attachment.name === 'trace')?.path;
  return {
    title: row.fullTitle,
    status: row.status,
    ...(error === undefined ? {} : { error }),
    ...(row.projectName === undefined ? {} : { device: row.projectName }),
    ...(trace === undefined ? {} : { trace }),
  };
}

export function criterionRuns(ticket: TicketCriteria, report: PlaywrightReport): readonly CriterionRun[] {
  const rows = flattenResults([...(report.suites ?? [])]);
  return (ticket.criterios ?? []).map(({ id }) => ({
    id,
    tests: rows.filter((row) => row.fullTitle.split(' › ').pop()?.startsWith(`${id}:`)).map(toCriterionTest),
  }));
}

/** A page that could not be reached, in Chromium, Firefox or WebKit words: the application is not up. */
const UNREACHABLE = /ERR_CONNECTION_REFUSED|NS_ERROR_CONNECTION_REFUSED|Could not connect to server/;

const NOT_UP =
  'a aplicação não respondeu no baseURL: configure envs[].start (e envs[].setup) no config.json do projeto, ou suba-a antes';

/** An error outside any test that comes from starting the application (`config.webServer`, from `envs[].start`). */
const WEB_SERVER = 'config.webServer';

/** The first line of an error: the message, without Playwright's call log. */
function firstLine(text: string): string {
  return text.replace(/\n[\s\S]*$/, '').trim();
}

/**
 * The test's own title, without the spec file and the suites before it, nor the `<id>:` it starts with (every
 * test of a criterion does, see `criterionRuns`).
 */
function shortTitle(test: CriterionTest, id: string): string {
  return test.title
    .replace(/^.* › /, '')
    .slice(id.length + 1)
    .trim();
}

function passed(test: CriterionTest): boolean {
  return PASSED.includes(test.status);
}

/** A test that passes is no problem in red: its criterion is already met, and stays as a regression test. */
function redProblem(test: CriterionTest, title: string): string | undefined {
  if (passed(test)) return undefined;
  if (!isRealFailure(test.status)) return `teste pulado: ${title}`;
  if (test.error !== undefined && BROKEN_TEST.test(test.error)) {
    return `o teste quebra no próprio código, não no comportamento: ${firstLine(test.error)}`;
  }
  return undefined;
}

function greenProblem(test: CriterionTest, title: string): string | undefined {
  if (PASSED.includes(test.status)) return undefined;
  return `ainda falha: ${title}${test.error === undefined ? '' : `: ${firstLine(test.error)}`}`;
}

/** One line per problem: the criterion and the device, then what is wrong, without the call log. */
function runProblems(expectation: Expectation, run: CriterionRun): readonly string[] {
  if (run.tests.length === 0) {
    return [`${run.id}: nenhum teste (o título precisa começar com "${run.id}:")`];
  }
  const problemOf = expectation === 'red' ? redProblem : greenProblem;
  return run.tests.flatMap((test) => {
    const problem = problemOf(test, shortTitle(test, run.id));
    const device = test.device === undefined ? '' : ` [${test.device}]`;
    return problem === undefined ? [] : [`${run.id}${device}: ${problem}`];
  });
}

/** Whether a test failed because the page could not be reached: then red and green both say so. */
function unreachable(runs: readonly CriterionRun[]): boolean {
  return runs.some((run) => run.tests.some((test) => test.error !== undefined && UNREACHABLE.test(test.error)));
}

function loadProblem(error: { readonly message?: string }): string {
  const message = error.message ?? '';
  return message.includes(WEB_SERVER)
    ? `a aplicação não subiu (envs[].start): ${firstLine(message)}`
    : `o spec não carregou: ${message}`;
}

/** A criterion is met when it has tests and all of them pass; otherwise it is still to implement. */
export function isMet(run: CriterionRun): boolean {
  return run.tests.length > 0 && run.tests.every(passed);
}

/**
 * Why the ticket's tests do not show `expectation`; empty when they do. Red: every criterion has a test, none
 * is broken or skipped, and at least one fails on the behavior (the ones that pass are criteria already met).
 * Green: every criterion has a test and all pass.
 */
export function verdictProblems(
  expectation: Expectation,
  ticket: TicketCriteria,
  report: PlaywrightReport,
): readonly string[] {
  const loadErrors = (report.errors ?? []).map(loadProblem);
  if (loadErrors.length > 0) return loadErrors;
  if ((ticket.criterios ?? []).length === 0) return ['o ticket não tem critérios'];
  const runs = criterionRuns(ticket, report);
  const problems = [...runs.flatMap((run) => runProblems(expectation, run)), ...(unreachable(runs) ? [NOT_UP] : [])];
  if (expectation === 'red' && runs.every(isMet)) {
    return [...problems, 'todos os critérios já passam: nada a implementar (é um ticket de regressão?)'];
  }
  return problems;
}

function formatTest(test: CriterionTest): readonly string[] {
  const line = `- ${test.title} (${test.status})`;
  const trace = test.trace === undefined ? [] : [`  trace: ${test.trace}`, ''];
  if (test.error === undefined) return [line, '', ...trace];
  const error = test.error.split('\n').map((text) => `  ${text}`);
  return [line, '', '  ```', ...error, '  ```', '', ...trace];
}

/** One line naming the criteria still to implement and the ones already met, e.g. for the red gate's output. */
export function formatCriteriaSummary(runs: readonly CriterionRun[]): string {
  const pending = runs.filter((run) => !isMet(run)).map((run) => run.id);
  const met = runs.filter(isMet).map((run) => run.id);
  const list = (ids: readonly string[]): string => (ids.length === 0 ? 'nenhum' : ids.join(', '));
  return `A implementar: ${list(pending)}. Já atendidos (regressão): ${list(met)}.`;
}

function formatSection(run: CriterionRun): readonly string[] {
  const title = isMet(run) ? `## ${run.id} — já atendido (regressão)` : `## ${run.id}`;
  return [title, '', ...(run.tests.length === 0 ? ['- nenhum teste', ''] : run.tests.flatMap(formatTest))];
}

/**
 * The tests of each criterion and how they failed, in Markdown: what the implementer works from. The criteria
 * still to implement come first; the ones already met come last, marked as such, since they are no failure.
 */
export function formatFailures(ticket: string, runs: readonly CriterionRun[]): string {
  const ordered = [...runs.filter((run) => !isMet(run)), ...runs.filter(isMet)];
  return [`# Falhas do ticket ${ticket}`, '', formatCriteriaSummary(runs), '', ...ordered.flatMap(formatSection)].join(
    '\n',
  );
}
