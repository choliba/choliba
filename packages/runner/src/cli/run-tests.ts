import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

import { writeStderr } from '@choliba/terminal/output';
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
  ticketsFolderPath,
  ticketSuffix,
  type ProjectLocations,
} from '@choliba/projects';

import { fillTicketTests } from '../fill-ticket-tests';
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

export function readProcessStdinIsTTY(): boolean {
  return process.stdin.isTTY;
}

export function isStdinInteractive(
  stdinIsTTY?: boolean,
  readStdinIsTTY: () => boolean = readProcessStdinIsTTY,
): boolean {
  return stdinIsTTY ?? readStdinIsTTY();
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
  const env = { ...process.env, ...options.env };
  const cwd = options.cwd ?? options.packageRoot;
  const argv = [...options.argv];
  const loadConfig = options.loadConfig ?? ((root, processEnv) => resolveLocations(root, processEnv));
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

      if (specs.length > 0) {
        for (const spec of specs) {
          targets.push(path.join(projectTestsFolder(projectsDir, projectName), spec));
        }
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

    const status = spawnPlaywrightFn(playwrightArgs, runEnv, cwd);

    if (ticket && ranWholeProject === 0) {
      try {
        fillTicketTests(`${projectName}:${ticketSuffix(projectName, ticket)}`, locations);
      } catch (err) {
        writeStderr(`${(err as Error).message}\n`);
      }
    }

    const reportFolder = resolveReportFolder(resolveTicketRunsRoot(locations), projectName, ticket || undefined);
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
