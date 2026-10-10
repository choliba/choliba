/**
 * Mede o cold start do CLI: quanto `choliba --version` e `choliba --help` levam do início ao fim, rodando do código-fonte
 * de dentro e de fora do repositório e instalado a partir do `.tgz`, comparados a um script Bun vazio (o piso). Uso:
 * `bun run bench:startup [execuções]` (padrão 10). O cenário instalado só entra se o `.tgz` existir; gere com
 * `bun run chol:pack`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { summarize, timingTable, type ScenarioResult } from './libs/bench-startup';

const repoRoot = join(import.meta.dirname, '..');
const source = join(repoRoot, 'packages', 'choliba', 'src', 'main.ts');
const tarball = join(repoRoot, 'packages', 'choliba', 'choliba-0.0.1-dev.tgz');
/** Runs discarded before measuring, so the file cache is warm in every scenario alike. */
const WARMUP = 2;

interface Scenario {
  readonly name: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

function timeOnce(scenario: Scenario): number {
  const start = performance.now();
  const result = spawnSync(process.execPath, [...scenario.args], { cwd: scenario.cwd, stdio: 'ignore' });
  const elapsed = performance.now() - start;
  if (result.status !== 0) throw new Error(`"${scenario.name}" saiu com o código ${String(result.status)}`);
  return elapsed;
}

function measure(scenario: Scenario, runs: number): ScenarioResult {
  for (let i = 0; i < WARMUP; i++) timeOnce(scenario);
  const samples = Array.from({ length: runs }, () => timeOnce(scenario));
  return { scenario: scenario.name, timing: summarize(samples) };
}

/**
 * Installs the `.tgz` into `dir` as a user would. Bun blocks the package's postinstall by default, so nothing runs
 * besides the install itself. Returns the installed bin.
 */
function install(dir: string): string {
  mkdirSync(dir);
  writeFileSync(join(dir, 'package.json'), '{ "name": "choliba-bench", "private": true }\n');
  const result = spawnSync(process.execPath, ['add', tarball], { cwd: dir, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`a instalação do .tgz falhou: ${result.stderr.trim()}`);
  return join(dir, 'node_modules', 'choliba', 'bin', 'choliba.js');
}

function scenarios(scratch: string): Scenario[] {
  // A folder with no tsconfig.json, like the one an agent runs `choliba` in.
  const outside = join(scratch, 'outside');
  mkdirSync(outside);
  const list: Scenario[] = [
    { name: 'Bun vazio (piso)', args: ['-e', '0'], cwd: repoRoot },
    { name: 'fonte, dentro do repo: `--version`', args: [source, '--version'], cwd: repoRoot },
    { name: 'fonte, dentro do repo: `--help`', args: [source, '--help'], cwd: repoRoot },
    { name: 'fonte, fora do repo: `--version`', args: [source, '--version'], cwd: outside },
  ];
  if (existsSync(tarball)) {
    const installed = join(scratch, 'installed');
    const bin = install(installed);
    list.push(
      { name: 'instalado (.tgz): `--version`', args: [bin, '--version'], cwd: installed },
      { name: 'instalado (.tgz): `--help`', args: [bin, '--help'], cwd: installed },
    );
  }
  return list;
}

const runs = Number(process.argv[2] ?? '10');
if (!Number.isInteger(runs) || runs < 1) {
  console.error('❌ o número de execuções deve ser um inteiro positivo.');
  process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), 'choliba-bench-'));
try {
  const list = scenarios(scratch);
  console.log(
    `⏱️  ${String(list.length)} cenários, ${String(runs)} execuções cada (Bun ${process.versions['bun'] ?? '?'})...`,
  );
  const results = list.map((scenario) => measure(scenario, runs));
  console.log(`\n${timingTable(results)}`);
  if (!existsSync(tarball)) {
    console.log('\nℹ️  Sem .tgz: rode `bun run chol:pack` para medir também o choliba instalado.');
  }
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
