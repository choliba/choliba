// Writes the command reference (docs/comandos/) from each command's spec; with --check, only says which pages are
// out of date and exits 1, for CI. The pages are committed: change the spec, then run `bun run docs:commands`.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { format, resolveConfig } from 'prettier';

import { createCholibaShell } from '../../../packages/choliba/src/app-shell';
import type { Runtime } from '../../../packages/choliba/src/runtime';
import { TERMINAL_RUN_SPEC } from '../../../packages/core/src/shell';
import { fakePlatform } from '../../../packages/core/src/testing';
import {
  commandPage,
  groupOf,
  indexPage,
  orderOf,
  pageFile,
  ROOT_WORDS,
  rootCommands,
  stalePages,
  stalePagesMessage,
  type DocCommand,
} from './commands';

const docsDir = path.join(import.meta.dirname, '..', '..', '..', 'docs', 'comandos');
const check = process.argv.includes('--check');

/** The help never runs anything: a runtime whose every call is a mistake. */
const NO_RUNTIME = new Proxy(
  {},
  {
    get: () => () => {
      throw new Error('o gerador da referência de comandos não roda nada');
    },
  },
) as Runtime;

/** The app's commands as its help lists them, read in an empty folder (no workspace, no agent installed). */
function commands(): readonly DocCommand[] {
  const empty = mkdtempSync(path.join(tmpdir(), 'choliba-docs-'));
  try {
    const shell = createCholibaShell(fakePlatform({ cwd: empty, env: {} }), NO_RUNTIME);
    return [
      ...rootCommands(shell.entries()),
      ...ROOT_WORDS,
      { name: 'terminal run', description: TERMINAL_RUN_SPEC.description ?? '', spec: TERMINAL_RUN_SPEC },
    ];
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
}

/** Each page of the reference by file name, formatted as `bun run format` would leave it. */
async function pages(): Promise<ReadonlyMap<string, string>> {
  const all = commands();
  const options = { ...(await resolveConfig(path.join(docsDir, 'index.md'))), parser: 'markdown' };
  const raw: [string, string][] = [
    ['index.md', indexPage(all)],
    ...all.map((command): [string, string] => [
      pageFile(command.name),
      commandPage(command, groupOf(command.name), orderOf(command.name)),
    ]),
  ];
  const formatted = await Promise.all(raw.map(async ([file, text]) => [file, await format(text, options)] as const));
  return new Map(formatted);
}

const wanted = await pages();
const present = existsSync(docsDir) ? readdirSync(docsDir).filter((file) => file.endsWith('.md')) : [];
const onDisk = new Map(present.map((file) => [file, readFileSync(path.join(docsDir, file), 'utf8')]));
const stale = stalePages(wanted, onDisk);

if (check) {
  if (stale.length > 0) {
    console.error(stalePagesMessage(stale));
    process.exit(1);
  }
} else {
  mkdirSync(docsDir, { recursive: true });
  for (const file of present.filter((name) => !wanted.has(name))) rmSync(path.join(docsDir, file));
  for (const [file, text] of wanted) writeFileSync(path.join(docsDir, file), text);
  console.log(`docs/comandos/: ${String(wanted.size)} páginas.`);
}
