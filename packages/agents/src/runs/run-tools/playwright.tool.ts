import { resourceStarts } from '@choliba/core/config';

/** Where `playwright cli` writes the files it names itself, unless `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR` says otherwise. */
export const DEFAULT_PLAYWRIGHT_OUTPUT_DIR = '.cache/playwright-cli';

export interface PlaywrightScriptOptions {
  /** `cli` (the browser) or `trace` (reads a trace.zip). */
  readonly command: 'cli' | 'trace';
  /** Where it runs: relative paths and the output folder are relative to it. */
  readonly workspaceRoot: string;
  /**
   * `cli` only: where it writes the files it names itself and the relative `--filename`s, which would
   * otherwise land in `.playwright-cli/` and in the workspace root.
   */
  readonly outputDir?: string;
  /**
   * Where the script looks for `@playwright/test` from, in order: by default the running choliba (the installed
   * `bin/choliba.js`, whose package has it), then this code's folder, as `resourceStarts` gives them.
   */
  readonly resolveFrom?: readonly string[];
}

/**
 * The script of a Playwright run tool, self-contained like `deleteScript`: it runs `playwright <command>` of
 * the Playwright that ships with choliba (found from here when the script runs, so no other version is
 * fetched), under Node when installed, in the workspace root, and exits with its code.
 */
export function playwrightScript(options: PlaywrightScriptOptions): string {
  // --no-install: without it, Bun would fetch a package it cannot find from its own cache, i.e. another Playwright.
  return `#!/usr/bin/env -S bun --no-install
import { spawnSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

const command = ${JSON.stringify(options.command)};
const workspaceRoot = ${JSON.stringify(options.workspaceRoot)};
const outputDir = ${JSON.stringify(options.outputDir ?? null)};
const starts = ${JSON.stringify(options.resolveFrom ?? resourceStarts(__dirname))};
const node = Bun.which('node') ?? process.execPath;

function playwrightCli() {
  for (const start of starts) {
    try {
      return Bun.resolveSync('@playwright/test/cli', start);
    } catch {
      // Not from here: the next start.
    }
  }
  console.error('Playwright do choliba não encontrado a partir de: ' + starts.join(', ') + '. Reinstale o choliba.');
  process.exit(1);
}

const cli = playwrightCli();

function inside(file) {
  return isAbsolute(file) ? file : join(outputDir, file);
}

const argv = process.argv.slice(2);
const args =
  outputDir === null
    ? argv
    : argv.map((arg, index) => {
        if (arg.startsWith('--filename=')) {
          return '--filename=' + inside(arg.slice('--filename='.length));
        }
        return argv[index - 1] === '--filename' ? inside(arg) : arg;
      });
const env = outputDir === null ? process.env : { ...process.env, PLAYWRIGHT_MCP_OUTPUT_DIR: outputDir };
const result = spawnSync(node, [cli, command, ...args], { stdio: 'inherit', cwd: workspaceRoot, env });
process.exit(result.status ?? 1);
`;
}
