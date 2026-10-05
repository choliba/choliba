#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { listAgents, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '@choliba/agents';
import { AgentsModule, AgentsService } from '@choliba/agents/nest';
import { complete, formatHelp, formatSuggestions } from '@choliba/core/cli';
import { createSpawnGitRunner } from '@choliba/core/platform';
import { findWorkspaceRoot, loadRepoConfig, locateResource } from '@choliba/core/config';
import { Module, type Type } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';

import { ExitStatus, PlatformModule } from '@choliba/core/nest';
import { takeGlobalFlags, type Platform } from '@choliba/core/platform';
import { ProjectsModule, ProjectsService } from '@choliba/projects/nest';
import { TestsModule, TestsService } from '@choliba/runner/nest';
import { createBunProcessSpawner } from '@choliba/terminal';
import { writeStderr, writeStdout } from '@choliba/terminal/output';

import { allFine, checkWorkspace, formatCheck } from './check';
import { install, parseInstallArgs } from './install';
import { DEFAULT_OUTPUT_DIR, intoOutputDir } from './playwright-args';
import { COMPLETION_BASH } from './completion';
import { CHOLIBA_HELP, firstWordSpec, route, subcommandHelp } from './route';
import { setup, setupWorkspace, updatePackageWhenListed } from './setup';

// Wiring only (excluded from coverage, like every main.ts): which part of choliba runs is decided
// by `route`, and each part is the same CLI the repository's own `chol:*` scripts run.

/** The command line without the global flags (`--no-color`), which every part of choliba gets from here. */
const GLOBAL = takeGlobalFlags(process.argv.slice(2));

/** The process and Bun, for the parts of choliba already on Nest. */
function bunPlatform(argv: readonly string[]): Platform {
  return {
    argv,
    cwd: process.cwd(),
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
    clock: () => new Date(),
    signals: process,
    spawn: createBunProcessSpawner(Bun.spawn),
    which: (bin) => Bun.which(bin),
    git: createSpawnGitRunner(),
    noColorFlag: GLOBAL.noColorFlag,
  };
}

@Module({})
class PartialAppModule {}

function partialApp(feature: Type, argv: readonly string[]) {
  return { module: PartialAppModule, imports: [PlatformModule.forRoot(bunPlatform(argv)), feature] };
}

/** A command of a part already on Nest, run like the app will run every command. */
async function runNest(feature: Type, argv: readonly string[]): Promise<number> {
  // The command-line parser reads process.argv: give it the line this part runs (no global flags, and
  // `agents <agent>` for the `choliba <agent>` shortcut).
  process.argv = [...process.argv.slice(0, 2), ...argv];
  const app = await CommandFactory.runWithoutClosing(partialApp(feature, argv), {
    logger: false,
    cliName: 'choliba',
    serviceErrorHandler: (error) => {
      writeStderr(`${error.message}\n`);
      process.exitCode = 1;
    },
  });
  const code = app.get(ExitStatus).code();
  await app.close();
  return code;
}

/** `choliba __complete projects|tests …`, from that part's own spec. */
async function completeFrom(feature: 'agents' | 'projects' | 'tests', words: readonly string[]): Promise<number> {
  const modules = { agents: AgentsModule, projects: ProjectsModule, tests: TestsModule };
  const app = await CommandFactory.createWithoutRunning(partialApp(modules[feature], []), { logger: false });
  const specs = {
    agents: () => app.get(AgentsService).helpSpec(),
    projects: () => app.get(ProjectsService).helpSpec(),
    tests: () => app.get(TestsService).helpSpec(),
  };
  const spec = specs[feature]();
  const output = formatSuggestions(complete(spec, words));
  await app.close();
  if (output !== '') writeStdout(`${output}\n`);
  return 0;
}

/** The executable a dependency of this package declares as `bin` (resolved from its package.json). */
function binOf(dependency: string, bin: string): string {
  const manifest = Bun.resolveSync(`${dependency}/package.json`, import.meta.dir);
  const declared: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
  const bins = typeof declared === 'object' && declared !== null && 'bin' in declared ? declared.bin : undefined;
  const relative = typeof bins === 'string' ? bins : (bins as Record<string, string> | undefined)?.[bin];
  if (relative === undefined) throw new Error(`${dependency} não declara o executável ${bin}.`);
  return join(dirname(manifest), relative);
}

/** Runs a Node tool shipped with this package (ESLint, Prettier) in the workspace. */
function runTool(dependency: string, bin: string, args: readonly string[], workspaceRoot: string): number {
  const node = Bun.which('node') ?? process.execPath;
  return spawnSync(node, [binOf(dependency, bin), ...args], { stdio: 'inherit', cwd: workspaceRoot }).status ?? 1;
}

/** `choliba lint`: ESLint on the workspace, with its own eslint.config.* or, without one, the config shipped here. */
function runLint(argv: readonly string[], workspaceRoot: string): number {
  const hasConfig = readdirSync(workspaceRoot).some((file) => /^eslint\.config\.[cm]?[jt]s$/.test(file));
  const shipped = locateResource('eslint.js', import.meta.dir);
  const config = hasConfig || shipped === undefined ? [] : ['--config', shipped];
  return runTool('eslint', 'eslint', [...config, ...(argv.length === 0 ? ['.'] : argv)], workspaceRoot);
}

/** `choliba format [--write] [paths…]`: Prettier checks the workspace, or fixes it with --write. */
function runFormat(argv: readonly string[], workspaceRoot: string): number {
  const write = argv.includes('--write');
  const paths = argv.filter((arg) => arg !== '--write');
  return runTool(
    'prettier',
    'prettier',
    [write ? '--write' : '--check', ...(paths.length === 0 ? ['.'] : paths)],
    workspaceRoot,
  );
}

/** `choliba install <origem>`: an agent (with its skills and MCPs), a skill or an MCP, into the workspace. */
function runInstall(argv: readonly string[], workspaceRoot: string): number {
  const config = loadRepoConfig(workspaceRoot);
  try {
    const report = install(parseInstallArgs(argv), {
      workspaceRoot,
      config,
      targets: {
        agentsDir: resolveAgentsDir(undefined, config, workspaceRoot),
        skillsDir: resolveSkillsDir(config, workspaceRoot),
        mcpsDir: resolveMcpsDir(config, workspaceRoot),
      },
      source: {
        cwd: process.cwd(),
        git: createSpawnGitRunner(),
        bunAdd: (project, spec) => {
          const result = spawnSync('bun', ['add', spec], { cwd: project, encoding: 'utf8' });
          return { status: result.status, stderr: result.stderr };
        },
      },
    });
    writeStdout(`${report}\n`);
    return 0;
  } catch (error) {
    writeStderr(`${(error as Error).message}\n`);
    return 1;
  }
}

/** `playwright cli`, from the Playwright this package depends on, run where the agents run it. */
/** `playwright <command> …` of the runner's own Playwright (`cli`, `trace`), so no other version is fetched. */
function runPlaywright(command: string, argv: readonly string[], workspaceRoot: string): number {
  const cli = Bun.resolveSync('@playwright/test/cli', import.meta.dir);
  const node = Bun.which('node') ?? process.execPath;
  return spawnSync(node, [cli, command, ...argv], { stdio: 'inherit', cwd: workspaceRoot }).status ?? 1;
}

/** Writes straight to the terminal (`/dev/tty`); false when there is none, as in CI. */
function writeToTerminal(text: string): boolean {
  try {
    writeFileSync('/dev/tty', text);
    return true;
  } catch {
    return false;
  }
}

/** The workspace, or nothing: completion must stay quiet outside one. */
function workspaceOrNothing(): string | undefined {
  try {
    return findWorkspaceRoot(process.cwd());
  } catch {
    return undefined;
  }
}

/** The agents of the workspace (`resolveAgentsDir`: `CHOL_AGENTS_DIR`, or the default), which `choliba <agent>` runs. */
function agentNames(workspaceRoot: string | undefined): readonly string[] {
  if (workspaceRoot === undefined) return [];
  try {
    const dir = resolveAgentsDir(undefined, loadRepoConfig(workspaceRoot), workspaceRoot);
    return listAgents(dir).map((agent) => agent.name);
  } catch {
    return [];
  }
}

/** `choliba __complete <words…>`: the first word here, the rest by the part of choliba it selects. */
async function completeWords(words: readonly string[]): Promise<number> {
  const workspaceRoot = workspaceOrNothing();
  const target = route(words);
  if (words.length > 1 && workspaceRoot !== undefined) {
    if (target.kind === 'agents') return completeFrom('agents', target.argv);
    if (target.kind === 'projects') return completeFrom('projects', target.argv);
    if (target.kind === 'tests') return completeFrom('tests', target.argv);
  }
  const spec = firstWordSpec(agentNames(workspaceRoot));
  const output = formatSuggestions(complete(spec, words));
  if (output !== '') writeStdout(`${output}\n`);
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const target = route(argv);
  if (target.kind === 'help') {
    writeStdout(`${formatHelp(CHOLIBA_HELP)}\n`);
    return 0;
  }
  if (target.kind === '__complete') return completeWords(target.argv);
  const help = subcommandHelp(target);
  if (help !== undefined) {
    writeStdout(`${formatHelp(help)}\n`);
    return 0;
  }
  if (target.kind === 'setup') {
    if (target.argv.includes('--deferred')) {
      await updatePackageWhenListed(process.cwd(), (ms) => Bun.sleep(ms));
      return 0;
    }
    const message = `${setup(homedir(), process.cwd(), () => {
      // Outlives the postinstall: finishes once `bun add` has written package.json.
      const script = process.argv[1] ?? '';
      Bun.spawn([process.execPath, script, 'setup', '--deferred'], {
        cwd: setupWorkspace(process.cwd()),
        stdio: ['ignore', 'ignore', 'ignore'],
      }).unref();
    })}\n`;
    // Bun hides a postinstall's output; the terminal itself still shows what is written to it.
    if (process.env['npm_lifecycle_event'] === 'postinstall' && writeToTerminal(message)) return 0;
    writeStdout(message);
    return 0;
  }
  if (target.kind === 'completion') {
    if (target.argv[0] !== 'bash') {
      writeStderr('Só o bash é suportado: choliba completion bash\n');
      return 1;
    }
    writeStdout(COMPLETION_BASH);
    return 0;
  }
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  if (target.kind === 'check') {
    const sections = checkWorkspace(workspaceRoot, loadRepoConfig(workspaceRoot));
    writeStdout(`${formatCheck(sections)}\n`);
    return allFine(sections) ? 0 : 1;
  }
  switch (target.kind) {
    case 'agents':
      return runNest(AgentsModule, ['agents', ...target.argv]);
    case 'projects':
      return runNest(ProjectsModule, ['projects', ...target.argv]);
    case 'tests':
      return runNest(TestsModule, ['tests', ...target.argv]);
    case 'playwright-cli': {
      const outputDir = loadRepoConfig(workspaceRoot)['CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR'] ?? DEFAULT_OUTPUT_DIR;
      return runPlaywright('cli', intoOutputDir(target.argv, outputDir), workspaceRoot);
    }
    case 'install':
      return runInstall(target.argv, workspaceRoot);
    case 'playwright-trace':
      return runPlaywright('trace', target.argv, workspaceRoot);
    case 'lint':
      return runLint(target.argv, workspaceRoot);
    case 'format':
      return runFormat(target.argv, workspaceRoot);
  }
}

main(GLOBAL.argv)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    writeStderr(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
