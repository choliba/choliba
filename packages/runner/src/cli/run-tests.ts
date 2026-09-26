import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

import { complete, describe, formatHelp, formatSuggestions, type CommandSpec } from '@choliba/core/cli';
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
} from '@choliba/projects';

import { fillTicketTests } from '../fill-ticket-tests';
import {
  EXPECTATIONS,
  criterionRuns,
  formatFailures,
  verdictProblems,
  type Expectation,
  type PlaywrightReport,
  type TicketCriteria,
} from '../ticket-verdict';
import {
  expandTicketSelector,
  isMultiTicketSelector,
  resolveCanonicalSuffix,
  stripProjectPrefix,
} from './ticket-expand';

/** Where the Playwright config reads the workspace root from, since it runs in a process of its own. */
export const WORKSPACE_ENV = 'CHOLIBA_WORKSPACE';

export type SpawnPlaywright = (args: string[], env: NodeJS.ProcessEnv, cwd: string) => number;

export type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'inherit' },
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
}

export interface RunTestsResult {
  exitCode: number;
}

/**
 * `NODE_PATH` with the `node_modules` that `@playwright/test` resolves from, seen from the runner, in
 * front of `current`. A spec imports `@playwright/test`, but a project's folder (PROJECTS_DIR may be
 * anywhere) has no `node_modules` of its own: this is where it finds the one the runner uses. When the
 * runner cannot resolve it either, `current` is kept as is.
 */
export function playwrightNodePath(packageRoot: string, current: string | undefined): string | undefined {
  let manifest: string;
  try {
    manifest = require.resolve('@playwright/test/package.json', { paths: [packageRoot] });
  } catch {
    return current;
  }
  // .../node_modules/@playwright/test/package.json → .../node_modules
  const modules = path.dirname(path.dirname(path.dirname(manifest)));
  if (current === undefined || current === '') return modules;
  // A run of several tickets calls this again with the env it built: the folder is there already.
  return current.split(path.delimiter).includes(modules) ? current : `${modules}${path.delimiter}${current}`;
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

/**
 * `choliba tests`, as `--help` shows it and completion walks: this CLI's own arguments (the projects
 * come from `projectNames`, and after `project:` its tickets from `ticketsOf`); any other flag goes on
 * to `playwright test`.
 */
export function testsCliSpec(
  projectNames: () => readonly string[],
  ticketsOf: (project: string) => readonly string[],
): CommandSpec {
  const targets = (current: string): readonly string[] => {
    const colon = current.indexOf(':');
    if (colon === -1) return projectNames();
    const project = current.slice(0, colon);
    return ticketsOf(project).map((ticket) => `${project}:${ticket}`);
  };
  return {
    usage: 'choliba tests [PROJECT[:TICKET][/PATH]] [OPTIONS] [PLAYWRIGHT OPTIONS]',
    description: [
      'Roda os testes E2E dos projetos com o Playwright. Sem PROJECT, roda todos os projetos.',
      '',
      '  demo                 todos os tickets do projeto demo',
      '  demo:T-01            os testes do ticket T-01',
      '  demo:T-01,T-02       uma lista de tickets (também glob e intervalo)',
      '  demo/tests/a.spec.ts um arquivo do projeto',
    ].join('\n'),
    flags: [
      {
        name: '--expect',
        description: 'O que a execução de um ticket deve mostrar; falha se não mostrar',
        value: { name: 'red|green', suggest: () => ({ kind: 'values', values: EXPECTATIONS }) },
      },
      {
        name: '--failures',
        description: 'Grava em FILE como os testes do ticket falharam',
        value: { name: 'file', suggest: () => ({ kind: 'files' }) },
      },
      { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
    ],
    positionals: (previous, current) => ({ kind: 'values', values: previous.length === 0 ? targets(current) : [] }),
    footer: "Outras opções vão para o 'playwright test'; veja 'bunx playwright test --help'.",
  };
}

/** What completion reads from PROJECTS_DIR; nothing when the workspace's locations cannot be read. */
function fromProjects(
  loadLocations: () => ProjectLocations,
  read: (projectsDir: string) => readonly string[],
): readonly string[] {
  try {
    return read(loadLocations().PROJECTS_DIR);
  } catch {
    return [];
  }
}

function isHelpFlag(arg: string): boolean {
  return arg === '--help' || arg === '-h';
}

function fail(message: string): never {
  writeStderr(`${message}\n`);
  throw new Error(message);
}

function terminalColumns(): string {
  return String(process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80);
}

function runPlaywright(args: string[], env: NodeJS.ProcessEnv, cwd: string, spawn: SpawnSyncFn): number {
  const result = spawn('bunx', ['playwright', ...args], {
    cwd,
    env,
    stdio: 'inherit',
  });
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

/** `--expect` and `--failures`: what a single ticket's run must show, and where to write how its tests failed. */
interface TicketGate {
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
function takeGateFlags(argv: readonly string[]): { argv: string[]; gate: TicketGate } {
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

function hasGate(gate: TicketGate): boolean {
  return gate.expectation !== undefined || gate.failuresFile !== undefined;
}

/**
 * After a gated run: writes `--failures` and checks `--expect` against the report the run left and
 * the ticket's criteria. Returns the run's exit code: the verdict's when `--expect` was given.
 */
function checkGate(gate: TicketGate, ticketFile: string, reportFolder: string, ticket: string, status: number): number {
  const resultsFile = path.join(reportFolder, 'results.json');
  if (!fs.existsSync(resultsFile)) {
    writeStderr(`erro: o Playwright não gravou ${resultsFile}; nada a conferir.\n`);
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
  if (problems.length === 0) return 0;
  writeStderr(`${ticket} não está ${gate.expectation}:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n`);
  return 1;
}

async function runTicketsSequentially(
  locations: ProjectLocations,
  project: string,
  tickets: string[],
  extras: string[],
  baseEnv: NodeJS.ProcessEnv,
  stdinIsTTY: boolean,
  options: RunTestsOptions,
): Promise<number> {
  let exitCode = 0;
  for (const ticket of tickets) {
    const result = await runTestsCli({
      ...options,
      argv: [`${project}:${ticket}`, ...extras],
      env: { ...baseEnv, QA_BATCH: '1' },
      stdinIsTTY: false,
      batch: true,
    });
    if (result.exitCode !== 0) exitCode = 1;
  }

  const prompt = options.promptOpenReport ?? askOpenReport;
  const spawnSyncFn = options.spawnSyncFn ?? spawnSync;
  const showReport =
    options.openHtmlReport ??
    ((runLocations, projectName, ticketName) => {
      openHtmlReport(runLocations, projectName, ticketName, options.packageRoot, spawnSyncFn);
    });

  if (stdinIsTTY && tickets.length === 1) {
    if (await prompt('Abrir o relatório HTML? [y/N] ')) {
      showReport(locations, project, tickets[0]);
    }
  }

  return exitCode;
}

export async function runTestsCli(options: RunTestsOptions): Promise<RunTestsResult> {
  const [command, ...rest] = options.argv;
  const loadConfig = options.loadConfig ?? ((root, processEnv) => resolveLocations(root, processEnv));
  const locationsNow = (): ProjectLocations => loadConfig(options.monorepoRoot, { ...process.env, ...options.env });
  const spec = testsCliSpec(
    () => fromProjects(locationsNow, listProjectNames),
    (project) =>
      fromProjects(locationsNow, (projectsDir) => listTicketSuffixes(ticketsFolderPath(projectsDir, project))),
  );
  if (command === '__complete') {
    const output = formatSuggestions(complete(spec, rest));
    if (output !== '') writeStdout(`${output}\n`);
    return { exitCode: 0 };
  }
  if (command === '__describe') {
    // One line for `bun chol:help`; the examples below it are for `--help`.
    writeStdout(`${describe(spec, rest).replace(/\n[\s\S]*/, '')}\n`);
    return { exitCode: 0 };
  }
  if (options.argv.some(isHelpFlag)) {
    writeStdout(`${formatHelp(spec)}\n`);
    return { exitCode: 0 };
  }
  // The Playwright config runs in its own process: it finds the workspace (its .env, PROJECTS_DIR) here.
  const baseEnv: NodeJS.ProcessEnv = { ...process.env, [WORKSPACE_ENV]: options.monorepoRoot, ...options.env };
  const nodePath = playwrightNodePath(options.packageRoot, baseEnv['NODE_PATH']);
  const env: NodeJS.ProcessEnv = nodePath === undefined ? baseEnv : { ...baseEnv, NODE_PATH: nodePath };
  const cwd = options.cwd ?? options.packageRoot;
  const { argv, gate } = takeGateFlags(options.argv);
  const spawnSyncFn = options.spawnSyncFn ?? spawnSync;
  const spawnPlaywrightFn =
    options.spawnPlaywright ?? ((args, processEnv, runCwd) => runPlaywright(args, processEnv, runCwd, spawnSyncFn));
  const prompt = options.promptOpenReport ?? askOpenReport;
  const showReport =
    options.openHtmlReport ??
    ((runLocations, projectName, ticketName) => {
      openHtmlReport(runLocations, projectName, ticketName, options.packageRoot, spawnSyncFn);
    });

  const locations = loadConfig(options.monorepoRoot, env);
  const projectsDir = locations.PROJECTS_DIR;
  let hasCustomResultsDir = 0;

  const cleanup = (): void => {
    if (hasCustomResultsDir === 1) {
      fs.rmSync(path.join(cwd, TEST_RESULTS_FOLDER), { recursive: true, force: true });
      fs.rmSync(path.join(cwd, REPORT_FOLDER), { recursive: true, force: true });
    }
  };

  try {
    if (argv.length === 0) {
      let exitCode = 0;
      for (const project of listProjectNames(projectsDir)) {
        const result = await runTestsCli({ ...options, argv: [project], env, cwd, stdinIsTTY: false, batch: true });
        if (result.exitCode !== 0) exitCode = 1;
      }
      return { exitCode };
    }

    if (argv[0]?.startsWith('-')) {
      const status = spawnPlaywrightFn(['test', ...argv], env, cwd);
      return { exitCode: status };
    }

    const target = argv.slice(0, 1).join('');
    const slashIndex = target.indexOf('/');
    const firstSegment = slashIndex === -1 ? target : target.slice(0, slashIndex);
    const pathSuffix = slashIndex === -1 ? '' : target.slice(slashIndex);
    const projectName = firstSegment.split(':').slice(0, 1).join('');
    let rawTicket = firstSegment.includes(':') ? firstSegment.split(':').slice(1, 2).join('') : '';
    let ticket = '';
    let consumedArgs = 1;

    if (argv.length >= 3 && argv[1] === '-' && argv[2] && !argv[2].startsWith('-') && !argv[2].includes('/')) {
      rawTicket = `${rawTicket} - ${argv[2]}`;
      consumedArgs = 3;
    } else if (rawTicket.includes(',') || /,\s*$/.test(rawTicket)) {
      let idx = /,\s*$/.test(rawTicket) ? 1 : 2;
      while (idx < argv.length) {
        const arg = argv[idx];
        if (!arg || arg.startsWith('--') || (arg.startsWith('-') && arg !== '-') || arg.includes('/')) break;
        rawTicket = rawTicket.endsWith(',') ? `${rawTicket}${arg}` : `${rawTicket},${arg}`;
        idx += 1;
      }
      consumedArgs = idx;
    }

    if (rawTicket) ticket = rawTicket;

    if (!ticket && argv[1] && !argv[1].startsWith('-') && argv[1].startsWith(`${projectName}-`)) {
      fail(
        `erro: "${projectName} ${argv[1]}" parece projeto e ticket separados por espaço — use ":" (ex.: ${projectName}:${argv[1]}).`,
      );
    }

    if (!projectName) {
      fail('erro: informe um projeto (ex.: demo, demo:T-01 ou demo/tests/a.spec.ts).');
    }
    // Nothing runs against a project that is missing a file, a valid environment or still holds CHANGE_ME.
    try {
      loadProjectSettings(projectsDir, projectName);
    } catch (err) {
      fail(`erro: ${(err as Error).message}`);
    }

    if (hasGate(gate) && (!ticket || pathSuffix || isMultiTicketSelector(rawTicket))) {
      fail(`erro: --expect e --failures valem para um ticket só (ex.: ${projectName}:T-01).`);
    }

    if (ticket && !isMultiTicketSelector(rawTicket)) {
      const canonicalSuffix = resolveCanonicalSuffix(projectsDir, projectName, stripProjectPrefix(projectName, ticket));
      ticket = fullTicket(projectName, canonicalSuffix);
    }

    const extras = argv.slice(consumedArgs);
    const targets: string[] = [];
    let ranWholeProject = 0;

    if (pathSuffix) {
      if (rawTicket && isMultiTicketSelector(rawTicket)) {
        fail('erro: glob/lista/intervalo de ticket não combina com path de arquivo.');
      }
      targets.push(path.join(projectDir(projectsDir, projectName), pathSuffix.replace(/^\//, '')));
    } else if (rawTicket && isMultiTicketSelector(rawTicket)) {
      const tickets = expandTicketSelector(projectsDir, projectName, rawTicket);
      const status = await runTicketsSequentially(
        locations,
        projectName,
        tickets,
        extras,
        env,
        isStdinInteractive(options.stdinIsTTY),
        options,
      );
      return { exitCode: status };
    } else if (ticket) {
      let specs: string[] = [];
      try {
        specs = resolveTicketSpecFiles(projectsDir, projectName, ticket);
      } catch (err) {
        fail((err as Error).message);
      }

      // Before a test passes the ticket references none: its own spec, named after it, is its test.
      const ownSpec = path.join(projectTestsFolder(projectsDir, projectName), `${ticket}.spec.ts`);
      if (specs.length > 0) {
        for (const spec of specs) {
          targets.push(path.join(projectTestsFolder(projectsDir, projectName), spec));
        }
      } else if (fs.existsSync(ownSpec)) {
        targets.push(ownSpec);
      } else {
        writeStderr(`aviso: ticket "${ticket}" ainda não tem teste referenciado — rodando o projeto inteiro.\n`);
        targets.push(projectDir(projectsDir, projectName));
        ranWholeProject = 1;
      }
    } else {
      const tickets = listTicketSuffixes(ticketsFolderPath(projectsDir, projectName)).map((suffix) =>
        fullTicket(projectName, suffix),
      );
      if (tickets.length > 0) {
        const status = await runTicketsSequentially(
          locations,
          projectName,
          tickets,
          extras,
          env,
          isStdinInteractive(options.stdinIsTTY),
          options,
        );
        return { exitCode: status };
      }
      targets.push(projectDir(projectsDir, projectName));
    }

    const playwrightArgs = ['test', ...targets, ...extras];
    const runEnv = {
      ...env,
      QA_TICKET: ticket,
      TERM_COLS: terminalColumns(),
    };

    const reportFolder = resolveReportFolder(resolveTicketRunsRoot(locations), projectName, ticket || undefined);
    // A report left by an earlier run must not pass for this one's.
    if (hasGate(gate)) fs.rmSync(path.join(reportFolder, 'results.json'), { force: true });

    const playwrightStatus = spawnPlaywrightFn(playwrightArgs, runEnv, cwd);
    const status = hasGate(gate)
      ? checkGate(
          gate,
          ticketJsonPath(projectsDir, projectName, ticketSuffix(projectName, ticket)),
          reportFolder,
          ticket,
          playwrightStatus,
        )
      : playwrightStatus;

    if (ticket && ranWholeProject === 0) {
      try {
        fillTicketTests(`${projectName}:${ticketSuffix(projectName, ticket)}`, locations);
      } catch (err) {
        writeStderr(`${(err as Error).message}\n`);
      }
    }

    if (reportFolder !== REPORT_FOLDER) hasCustomResultsDir = 1;

    if (isStdinInteractive(options.stdinIsTTY) && !options.batch && !env['QA_BATCH']) {
      if (await prompt('Abrir o relatório HTML? [y/N] ')) {
        showReport(locations, projectName, ticket || undefined);
      }
    }

    return { exitCode: status };
  } finally {
    cleanup();
  }
}
