/** Mostra a ajuda dos scripts do monorepo; com um script, mostra a ajuda dele. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ScriptCli } from '../packages/core/src/help';
import {
  formatHelp,
  readPackageScripts,
  resolveScriptCli,
  scriptsHelpSpec,
  scriptSummary,
} from '../packages/core/src/help';

const repoRoot = join(import.meta.dirname, '..');
const pkg = readPackageScripts(JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as unknown);
const [name] = process.argv.slice(2);

/** The CLI describes itself (`__describe`), so its line in the help never falls behind. */
function describeCli(cli: ScriptCli): string {
  const result = spawnSync('bun', [cli.file, '__describe', ...cli.args], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

if (name === undefined || name === '--help' || name === '-h') {
  console.log(formatHelp(scriptsHelpSpec(pkg, repoRoot, describeCli)));
  process.exit(0);
}

const command = pkg.scripts[name];
if (command === undefined) {
  console.error(`Script desconhecido: "${name}". Rode 'bun chol:help' para ver a lista.`);
  process.exit(1);
}

// A script that runs a repo CLI shows that CLI's own help, like `docker COMMAND --help`.
const cli = resolveScriptCli(pkg.scripts, name, repoRoot);
if (cli !== undefined) {
  const result = spawnSync('bun', [cli.file, ...cli.args, '--help'], { cwd: repoRoot, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

const summary = scriptSummary(pkg.scripts, name, repoRoot);
const description = summary === command ? `  $ ${command}` : `${summary}\n\n  $ ${command}`;
console.log(formatHelp({ usage: `bun run ${name}`, description }));
