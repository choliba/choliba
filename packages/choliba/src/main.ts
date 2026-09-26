#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { listAgents, runAgentsCli } from '@choliba/agents';
import { complete, formatHelp, formatSuggestions } from '@choliba/core/cli';
import { CHOL_AGENTS_DIR, findWorkspaceRoot, loadRepoConfig } from '@choliba/core/config';
import { projectTemplatesDir, resolveLocations, runProjectsCli } from '@choliba/projects';
import { findRunnerRoot, runTestsCli } from '@choliba/runner';
import { createBunProcessSpawner, ProcessRunner } from '@choliba/terminal';
import { writeStderr, writeStdout } from '@choliba/terminal/output';

import { allFine, checkWorkspace, formatCheck } from './check';
import { COMPLETION_BASH } from './completion';
import { CHOLIBA_HELP, firstWordSpec, route } from './route';
import { setup } from './setup';

// Wiring only (excluded from coverage, like every main.ts): which part of choliba runs is decided
// by `route`, and each part is the same CLI the repository's own `chol:*` scripts run.

async function runAgents(argv: readonly string[], workspaceRoot: string): Promise<number> {
  return runAgentsCli(argv, {
    runner: new ProcessRunner({ spawner: createBunProcessSpawner(Bun.spawn) }),
    which: (bin) => Bun.which(bin),
    repoRoot: workspaceRoot,
    commands: [],
    config: loadRepoConfig(workspaceRoot),
    now: () => new Date(),
    stdout: process.stdout,
    stderr: process.stderr,
    signals: process,
  });
}

function runProjects(argv: readonly string[], workspaceRoot: string): number {
  return runProjectsCli(['bun', 'choliba', ...argv], {
    loadConfig: () => resolveLocations(workspaceRoot),
    templatesDir: projectTemplatesDir(),
    stdout: { write: writeStdout },
    stderr: { write: writeStderr },
  });
}

/** `playwright cli`, from the Playwright this package depends on, run where the agents run it. */
function runPlaywrightCli(argv: readonly string[], workspaceRoot: string): number {
  const cli = Bun.resolveSync('@playwright/test/cli', import.meta.dir);
  const node = Bun.which('node') ?? process.execPath;
  return spawnSync(node, [cli, 'cli', ...argv], { stdio: 'inherit', cwd: workspaceRoot }).status ?? 1;
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

/** The agents of the workspace (its `agents/`, or `CHOL_AGENTS_DIR`), which `choliba <agent>` runs. */
async function agentNames(workspaceRoot: string | undefined): Promise<readonly string[]> {
  if (workspaceRoot === undefined) return [];
  const configured = loadRepoConfig(workspaceRoot)[CHOL_AGENTS_DIR];
  const dir =
    configured === undefined
      ? join(workspaceRoot, 'agents')
      : isAbsolute(configured)
        ? configured
        : join(workspaceRoot, configured);
  try {
    return (await listAgents(dir)).map((agent) => agent.name);
  } catch {
    return [];
  }
}

/** `choliba __complete <words…>`: the first word here, the rest by the part of choliba it selects. */
async function completeWords(words: readonly string[]): Promise<number> {
  const workspaceRoot = workspaceOrNothing();
  if (words.length <= 1) {
    const output = formatSuggestions(complete(firstWordSpec(await agentNames(workspaceRoot)), words));
    if (output !== '') writeStdout(`${output}\n`);
    return 0;
  }
  const target = route(words);
  if (workspaceRoot === undefined) return 0;
  if (target.kind === 'agents') return runAgents(['__complete', ...target.argv], workspaceRoot);
  if (target.kind === 'projects') return runProjects(['__complete', ...target.argv], workspaceRoot);
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const target = route(argv);
  if (target.kind === 'help') {
    writeStdout(`${formatHelp(CHOLIBA_HELP)}\n`);
    return 0;
  }
  if (target.kind === '__complete') return completeWords(target.argv);
  if (target.kind === 'setup') {
    const message = `${setup(homedir(), process.cwd())}\n`;
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
    const sections = await checkWorkspace(workspaceRoot, loadRepoConfig(workspaceRoot));
    writeStdout(`${formatCheck(sections)}\n`);
    return allFine(sections) ? 0 : 1;
  }
  switch (target.kind) {
    case 'agents':
      return runAgents(target.argv, workspaceRoot);
    case 'projects':
      return runProjects(target.argv, workspaceRoot);
    case 'tests':
      return (await runTestsCli({ argv: [...target.argv], packageRoot: findRunnerRoot(), monorepoRoot: workspaceRoot }))
        .exitCode;
    case 'playwright-cli':
      return runPlaywrightCli(target.argv, workspaceRoot);
  }
}

main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    writeStderr(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
