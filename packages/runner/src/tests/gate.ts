import fs from 'node:fs';
import path from 'node:path';

import type { Writable } from '@choliba/core/platform';
import type { Theme } from '@choliba/core/theme';

import { fail } from './tests-error';
import {
  EXPECTATIONS,
  criterionRuns,
  formatFailures,
  formatCriteriaSummary,
  verdictProblems,
  type Expectation,
  type PlaywrightReport,
  type TicketCriteria,
} from './ticket-verdict';

/** `--expect` and `--failures`: what a single ticket's run must show, and where to write how its tests failed. */
export interface TicketGate {
  readonly expectation?: Expectation;
  readonly failuresFile?: string;
}

const GATE_FLAGS = ['--expect', '--failures'] as const;

/** The value of `--flag=value`, or of `--flag value` (taken from `queue`). */
function flagValue(arg: string, queue: string[], flag: string): string {
  if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  const value = queue.shift();
  if (value === undefined || value.startsWith('-')) fail(`erro: ${flag} precisa de um valor.`);
  return value;
}

function parseExpectation(value: string): Expectation {
  const expectation = EXPECTATIONS.find((candidate) => candidate === value);
  if (expectation === undefined) fail(`erro: --expect aceita ${EXPECTATIONS.join(' ou ')}, não "${value}".`);
  return expectation;
}

/** `argv` without the gate flags, which are this CLI's and never reach Playwright. */
export function takeGateFlags(argv: readonly string[]): { argv: string[]; gate: TicketGate } {
  const rest: string[] = [];
  let gate: TicketGate = {};
  const queue = [...argv];
  let arg: string | undefined;
  while ((arg = queue.shift()) !== undefined) {
    const current = arg;
    const flag = GATE_FLAGS.find((name) => current === name || current.startsWith(`${name}=`));
    if (flag === undefined) {
      rest.push(current);
      continue;
    }
    const value = flagValue(current, queue, flag);
    gate = flag === '--expect' ? { ...gate, expectation: parseExpectation(value) } : { ...gate, failuresFile: value };
  }
  return { argv: rest, gate };
}

export function hasGate(gate: TicketGate): boolean {
  return gate.expectation !== undefined || gate.failuresFile !== undefined;
}

/**
 * After a gated run: writes `--failures` and checks `--expect` against the report the run left and
 * the ticket's criteria. Returns the run's exit code: the verdict's when `--expect` was given.
 */
/** Where a gated run writes: the verdict on stdout, what is wrong on stderr. */
export interface GateOutput {
  readonly stdout: Writable;
  readonly stderr: Writable;
  /** The verdict word (`red`, `green`) in the color of its gate. */
  readonly theme: Pick<Theme, 'paint'>;
}

export interface GatedRun {
  readonly ticketFile: string;
  readonly reportFolder: string;
  readonly ticket: string;
  readonly status: number;
}

export function checkGate(gate: TicketGate, run: GatedRun, output: GateOutput): number {
  const { ticketFile, reportFolder, ticket, status } = run;
  const resultsFile = path.join(reportFolder, 'results.json');
  if (!fs.existsSync(resultsFile)) {
    output.stderr.write(`erro: o Playwright não gravou ${resultsFile}; nada a conferir.\n`);
    return 1;
  }
  const report = JSON.parse(fs.readFileSync(resultsFile, 'utf8')) as PlaywrightReport;
  const criteria = JSON.parse(fs.readFileSync(ticketFile, 'utf8')) as TicketCriteria;
  if (gate.failuresFile !== undefined) {
    fs.mkdirSync(path.dirname(gate.failuresFile), { recursive: true });
    fs.writeFileSync(gate.failuresFile, formatFailures(ticket, criterionRuns(criteria, report)));
  }
  if (gate.expectation === undefined) return status;
  const problems = [
    ...verdictProblems(gate.expectation, criteria, report),
    ...(gate.expectation === 'green' && status !== 0 ? [`o Playwright terminou com ${String(status)}`] : []),
  ];
  if (problems.length === 0) {
    if (gate.expectation === 'red') {
      const verdict = output.theme.paint('gates', 'red', 'red');
      output.stdout.write(`${ticket} está ${verdict}. ${formatCriteriaSummary(criterionRuns(criteria, report))}\n`);
    }
    return 0;
  }
  const expected = output.theme.paint('gates', gate.expectation, gate.expectation);
  output.stderr.write(`${ticket} não está ${expected}:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n`);
  return 1;
}
