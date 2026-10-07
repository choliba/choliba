import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

import type { Writable } from '@choliba/core/platform';
import type { Theme } from '@choliba/core/theme';
import { writeStderr, writeStdout } from '@choliba/terminal/output';
import {
  fullTicket,
  listProjectNames,
  listTicketSuffixes,
  loadProjectSettings,
  projectDir,
  projectTestsFolder,
  REPORT_FOLDER,
  resolveLocations,
  resolveReportFolder,
  resolveTicketRunsRoot,
  resolveTicketSpecFiles,
  TEST_RESULTS_FOLDER,
  ticketJsonPath,
  ticketsFolderPath,
  ticketSuffix,
  type ProjectLocations,
  type ProjectSettings,
  APP_PREPARED_ENV,
  formatRetired,
  fullyRetiredTickets,
  prepareApp,
} from '@choliba/projects';

import { fillTicketTests } from './fill-ticket-tests';
import { checkGate, hasGate, takeGateFlags, type TicketGate } from './gate';
import { playwrightNodePath, WORKSPACE_ENV } from './playwright-env';
import { parseTestsTarget, type TestsTarget } from './target';
import { guardRetiredTicket, retiredOf } from './retired';
import { fail } from './tests-error';
import {
  expandTicketSelector,
  isMultiTicketSelector,
  resolveCanonicalSuffix,
  stripProjectPrefix,
} from './ticket-expand';

export type SpawnPlaywright = (args: string[], env: NodeJS.ProcessEnv, cwd: string) => number;

export type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'inherit'; shell?: true },
) => { status: number | null };

export interface RunTestsOptions {
  argv: readonly string[];
  packageRoot: string;
  monorepoRoot: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  stdinIsTTY?: boolean;
  batch?: boolean;
  loadConfig?: (repoRoot: string, env: NodeJS.ProcessEnv) => ProjectLocations;
  spawnPlaywright?: SpawnPlaywright;
  spawnSyncFn?: SpawnSyncFn;
  promptOpenReport?: (prompt: string) => Promise<boolean>;
  openHtmlReport?: (locations: ProjectLocations, project: string, ticket: string | undefined) => void;
  stdout?: Writable;
  stderr?: Writable;
  /** Colors of what this prints (the gate's verdict); plain text by default. */
  theme?: Pick<Theme, 'paint'>;
}

export interface RunTestsResult {
  exitCode: number;
}

export function readProcessStdinIsTTY(): boolean {
  return process.stdin.isTTY;
}

export function isStdinInteractive(
  stdinIsTTY?: boolean,
  readStdinIsTTY: () => boolean = readProcessStdinIsTTY,
): boolean {
  return stdinIsTTY ?? readStdinIsTTY();
}

const PLAIN: Pick<Theme, 'paint'> = { paint: (_role, _name, text) => text };

const PROCESS_STDOUT: Writable = {
  write: (chunk) => {
    writeStdout(chunk);
  },
};
const PROCESS_STDERR: Writable = {
  write: (chunk) => {
    writeStderr(chunk);
  },
};

function terminalColumns(): string {
  return String(process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80);
}

function runPlaywright(args: string[], env: NodeJS.ProcessEnv, cwd: string, spawn: SpawnSyncFn): number {
  const result = spawn('bunx', ['playwright', ...args], { cwd, env, stdio: 'inherit' });
  return result.status ?? 1;
}

async function askOpenReport(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(prompt);
    return /^y$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function openHtmlReport(
  locations: ProjectLocations,
  project: string,
  ticket: string | undefined,
  packageRoot: string,
  spawn: SpawnSyncFn,
): void {
  const reportDir = resolveReportFolder(resolveTicketRunsRoot(locations), project, ticket);
  spawn('bunx', ['playwright', 'show-report', reportDir], { stdio: 'inherit', cwd: packageRoot, env: process.env });
}

/** Everything one run needs, resolved once from the options. */
interface RunContext {
  readonly options: RunTestsOptions;
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
  readonly locations: ProjectLocations;
  readonly stdout: Writable;
  readonly stderr: Writable;
  readonly theme: Pick<Theme, 'paint'>;
  readonly spawnPlaywright: SpawnPlaywright;
  readonly spawnSyncFn: SpawnSyncFn;
  readonly prompt: (prompt: string) => Promise<boolean>;
  readonly showReport: (locations: ProjectLocations, project: string, ticket: string | undefined) => void;
  /** Set once Playwright wrote this run's report to a folder of its own: then the default ones in `cwd` go. */
  readonly cleanup: { needed: boolean };
}

function contextFor(options: RunTestsOptions): RunContext {
  const loadConfig = options.loadConfig ?? ((root, processEnv) => resolveLocations(root, processEnv));
  // The Playwright config runs in its own process: it finds the workspace (its .env, CHOL_PROJECTS_DIR) here.
  const baseEnv: NodeJS.ProcessEnv = { ...process.env, [WORKSPACE_ENV]: options.monorepoRoot, ...options.env };
  const nodePath = playwrightNodePath(options.packageRoot, baseEnv['NODE_PATH']);
  const env: NodeJS.ProcessEnv = nodePath === undefined ? baseEnv : { ...baseEnv, NODE_PATH: nodePath };
  const spawnSyncFn = options.spawnSyncFn ?? spawnSync;
  return {
    options,
    env,
    cwd: options.cwd ?? options.packageRoot,
    locations: loadConfig(options.monorepoRoot, env),
    stdout: options.stdout ?? PROCESS_STDOUT,
    stderr: options.stderr ?? PROCESS_STDERR,
    theme: options.theme ?? PLAIN,
    spawnPlaywright:
      options.spawnPlaywright ?? ((args, processEnv, runCwd) => runPlaywright(args, processEnv, runCwd, spawnSyncFn)),
    spawnSyncFn,
    prompt: options.promptOpenReport ?? askOpenReport,
    showReport:
      options.openHtmlReport ??
      ((runLocations, projectName, ticketName) => {
        openHtmlReport(runLocations, projectName, ticketName, options.packageRoot, spawnSyncFn);
      }),
    cleanup: { needed: false },
  };
}

/** Runs each of `targets` (more command lines) as a batch: no prompt, exit code 1 when any failed. */
async function runBatch(
  context: RunContext,
  argvs: readonly (readonly string[])[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  let exitCode = 0;
  for (const argv of argvs) {
    const result = await runTests({ ...context.options, argv, env, cwd: context.cwd, stdinIsTTY: false, batch: true });
    if (result.exitCode !== 0) exitCode = 1;
  }
  return exitCode;
}

async function runTicketsSequentially(
  context: RunContext,
  project: string,
  tickets: readonly string[],
  extras: readonly string[],
): Promise<number> {
  const exitCode = await runBatch(
    context,
    tickets.map((ticket) => [`${project}:${ticket}`, ...extras]),
    // The application was prepared once, for the whole batch.
    { ...context.env, QA_BATCH: '1', [APP_PREPARED_ENV]: '1' },
  );
  if (isStdinInteractive(context.options.stdinIsTTY) && tickets.length === 1) {
    if (await context.prompt('Abrir o relatório HTML? [y/N] ')) {
      context.showReport(context.locations, project, tickets[0]);
    }
  }
  return exitCode;
}

/** The ticket typed, canonical (`demo-T-01`), or empty for none or for a multi-ticket selector. */
function canonicalTicket(projectsDir: string, target: TestsTarget): string {
  const { project, rawTicket } = target;
  if (!rawTicket || isMultiTicketSelector(rawTicket)) return rawTicket;
  return fullTicket(project, resolveCanonicalSuffix(projectsDir, project, stripProjectPrefix(project, rawTicket)));
}

/** What a single ticket runs: the specs it references, else its own spec, else (with a warning) the whole project. */
function ticketTargets(
  context: RunContext,
  project: string,
  ticket: string,
): { targets: string[]; wholeProject: boolean } {
  const projectsDir = context.locations.CHOL_PROJECTS_DIR;
  let specs: string[] = [];
  try {
    specs = resolveTicketSpecFiles(projectsDir, project, ticket);
  } catch (err) {
    fail((err as Error).message);
  }
  const testsFolder = projectTestsFolder(projectsDir, project);
  if (specs.length > 0) {
    return { targets: specs.map((spec) => path.join(testsFolder, spec)), wholeProject: false };
  }
  // Before a test passes the ticket references none: its own spec, named after it, is its test.
  const ownSpec = path.join(testsFolder, `${ticket}.spec.ts`);
  if (fs.existsSync(ownSpec)) {
    return { targets: [ownSpec], wholeProject: false };
  }
  context.stderr.write(`aviso: ticket "${ticket}" ainda não tem teste referenciado — rodando o projeto inteiro.\n`);
  return { targets: [projectDir(projectsDir, project)], wholeProject: true };
}

/** Runs Playwright on `targets` once, checks the gate, fills the ticket's tests and offers the report. */
async function runOnce(
  context: RunContext,
  run: {
    project: string;
    ticket: string;
    targets: string[];
    extras: readonly string[];
    gate: TicketGate;
    wholeProject: boolean;
  },
): Promise<number> {
  const { project, ticket, targets, extras, gate } = run;
  const projectsDir = context.locations.CHOL_PROJECTS_DIR;
  const runEnv = { ...context.env, QA_TICKET: ticket, TERM_COLS: terminalColumns() };
  const reportFolder = resolveReportFolder(resolveTicketRunsRoot(context.locations), project, ticket || undefined);
  // A report left by an earlier run must not pass for this one's.
  if (hasGate(gate)) fs.rmSync(path.join(reportFolder, 'results.json'), { force: true });

  const playwrightStatus = context.spawnPlaywright(['test', ...targets, ...extras], runEnv, context.cwd);
  const status = hasGate(gate)
    ? checkGate(
        gate,
        {
          ticketFile: ticketJsonPath(projectsDir, project, ticketSuffix(project, ticket)),
          reportFolder,
          ticket,
          status: playwrightStatus,
        },
        context,
      )
    : playwrightStatus;

  if (ticket && !run.wholeProject) {
    try {
      fillTicketTests(`${project}:${ticketSuffix(project, ticket)}`, context.locations, context);
    } catch (err) {
      context.stderr.write(`${(err as Error).message}\n`);
    }
  }

  if (reportFolder !== REPORT_FOLDER) context.cleanup.needed = true;

  const { options } = context;
  if (isStdinInteractive(options.stdinIsTTY) && !options.batch && !context.env['QA_BATCH']) {
    if (await context.prompt('Abrir o relatório HTML? [y/N] ')) {
      context.showReport(context.locations, project, ticket || undefined);
    }
  }
  return status;
}

/** `choliba tests <target> [options]`: one project, one or several tickets, or a path in a project. */
async function runTarget(
  context: RunContext,
  first: string,
  argv: readonly string[],
  gate: TicketGate,
): Promise<number> {
  const projectsDir = context.locations.CHOL_PROJECTS_DIR;
  const target = parseTestsTarget(first, argv);
  const { project, rawTicket, pathSuffix } = target;
  // Nothing runs against a project that is missing a file, a valid environment or still holds CHANGE_ME.
  let settings: ProjectSettings;
  try {
    settings = loadProjectSettings(projectsDir, project);
  } catch (err) {
    fail(`erro: ${(err as Error).message}`);
  }
  if (hasGate(gate) && (!rawTicket || pathSuffix || isMultiTicketSelector(rawTicket))) {
    fail(`erro: --expect e --failures valem para um ticket só (ex.: ${project}:T-01).`);
  }
  const ticket = canonicalTicket(projectsDir, target);
  try {
    prepareApp(settings, { projectsDir, env: context.env, stderr: context.stderr, spawn: context.spawnSyncFn });
  } catch (err) {
    fail(`erro: ${(err as Error).message}`);
  }
  const extras = argv.slice(target.consumedArgs);
  const once = { project, ticket, extras, gate, wholeProject: false };
  // Criteria a later ticket replaces (`substitui`) leave the project's runs; a ticket run on its own says so.
  const retired = retiredOf(projectsDir, project);
  const inBatch = context.env['QA_BATCH'] !== undefined;
  if (ticket && !isMultiTicketSelector(ticket) && !inBatch) {
    guardRetiredTicket(ticket, retired, hasGate(gate), context.stderr);
  } else if (retired.length > 0 && !inBatch) {
    context.stderr.write(`${formatRetired(retired)}\n`);
  }

  if (pathSuffix) {
    if (rawTicket && isMultiTicketSelector(rawTicket)) {
      fail('erro: glob/lista/intervalo de ticket não combina com path de arquivo.');
    }
    return runOnce(context, {
      ...once,
      targets: [path.join(projectDir(projectsDir, project), pathSuffix.replace(/^\//, ''))],
    });
  }
  const skipRetired = (tickets: readonly string[]): readonly string[] => {
    const retiredTickets = fullyRetiredTickets(projectsDir, project);
    return tickets.filter((candidate) => !retiredTickets.has(candidate));
  };
  if (rawTicket && isMultiTicketSelector(rawTicket)) {
    return runTicketsSequentially(
      context,
      project,
      skipRetired(expandTicketSelector(projectsDir, project, rawTicket)),
      extras,
    );
  }
  if (ticket) {
    return runOnce(context, { ...once, ...ticketTargets(context, project, ticket) });
  }
  const tickets = listTicketSuffixes(ticketsFolderPath(projectsDir, project)).map((suffix) =>
    fullTicket(project, suffix),
  );
  if (tickets.length > 0) {
    return runTicketsSequentially(context, project, skipRetired(tickets), extras);
  }
  return runOnce(context, { ...once, targets: [projectDir(projectsDir, project)] });
}

/**
 * `choliba tests`: every project, a project, one or several of its tickets, or a path in it, through
 * `playwright test`; any flag it does not know goes on to Playwright. Throws `TestsError` for a command line
 * it cannot run.
 */
export async function runTests(options: RunTestsOptions): Promise<RunTestsResult> {
  const context = contextFor(options);
  const { argv, gate } = takeGateFlags(options.argv);
  const [first] = argv;
  try {
    if (first === undefined) {
      const projects = listProjectNames(context.locations.CHOL_PROJECTS_DIR).map((project) => [project]);
      return { exitCode: await runBatch(context, projects, context.env) };
    }
    if (first.startsWith('-')) {
      return { exitCode: context.spawnPlaywright(['test', ...argv], context.env, context.cwd) };
    }
    return { exitCode: await runTarget(context, first, argv, gate) };
  } finally {
    cleanup(context);
  }
}

/** The default report and results folders left in `cwd`, after a run whose report went to a folder of its own. */
function cleanup(context: RunContext): void {
  if (!context.cleanup.needed) return;
  fs.rmSync(path.join(context.cwd, TEST_RESULTS_FOLDER), { recursive: true, force: true });
  fs.rmSync(path.join(context.cwd, REPORT_FOLDER), { recursive: true, force: true });
}
