/**
 * Notas da pré-release, refeitas do git a cada merge na master. Uso: `bun scripts/release-notes.ts [COMMIT]` (padrão
 * HEAD); o CI passa `GITHUB_REPOSITORY`, `TAG` e `GH_TOKEN`. Os "Destaques" vêm do PR de release, pelo `gh`: sem ele,
 * as notas saem sem eles e um aviso vai para o stderr.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { highlightsOf, releaseNotes, type Commit, type Release } from './libs/release-notes';

const repoRoot = join(import.meta.dirname, '..');
const repository = process.env['GITHUB_REPOSITORY'] ?? 'choliba/choliba';
const tag = process.env['TAG'] ?? 'v0.0.1-dev';

/** Separam campos e registros de um `git log --format` (caracteres de controle, que não aparecem em mensagens). */
const FIELD = '\x1f';
const RECORD = '\x1e';

function run(command: string, args: readonly string[]): { readonly status: number; readonly stdout: string } {
  const result = spawnSync(command, [...args], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  return { status: result.status ?? 1, stdout: result.stdout };
}

function git(args: readonly string[]): string {
  const result = run('git', args);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} falhou`);
  return result.stdout;
}

function records(output: string): readonly (readonly string[])[] {
  return output
    .split(RECORD)
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record !== '')
    .map((record) => record.split(FIELD));
}

/** Os commits que um merge trouxe: os do segundo pai que o primeiro ainda não tinha, sem merges. */
function mergedCommits(previous: string, merged: string): readonly Commit[] {
  const output = git(['log', '--no-merges', `--format=%H${FIELD}%s${FIELD}%b${RECORD}`, `${previous}..${merged}`]);
  return records(output).map(([hash = '', subject = '', body = '']) => ({ hash, subject, body }));
}

let warned = false;

/** Os "## Destaques" do PR de release, lidos pelo `gh`; sem `gh` (ou sem acesso), nenhum, com um aviso só. */
function highlights(pullRequest: number): string | undefined {
  const result = run('gh', ['api', `repos/${repository}/pulls/${String(pullRequest)}`, '--jq', '.body']);
  if (result.status === 0) return highlightsOf(result.stdout);
  if (!warned) process.stderr.write('Sem acesso ao gh: as notas saem sem os Destaques dos PRs de release.\n');
  warned = true;
  return undefined;
}

/** Cada merge de primeiro pai até `commit`: as releases, a mais nova primeiro, numeradas a partir da mais antiga. */
function releases(commit: string): readonly Release[] {
  const format = ['%H', '%P', '%ad', '%s'].join(FIELD) + RECORD;
  const merges = records(git(['log', '--first-parent', '--merges', '--date=short', `--format=${format}`, commit]));
  return merges.map(([hash = '', parents = '', date = '', subject = ''], index) => {
    const [previous = '', merged = ''] = parents.split(' ');
    const found = /^Merge pull request #(\d+)/.exec(subject)?.[1];
    const pullRequest = found === undefined ? undefined : Number(found);
    return {
      hash,
      previous,
      date,
      number: merges.length - index,
      pullRequest,
      highlights: pullRequest === undefined ? undefined : highlights(pullRequest),
      commits: mergedCommits(previous, merged),
    };
  });
}

const manifest = JSON.parse(readFileSync(join(repoRoot, 'packages', 'choliba', 'package.json'), 'utf8')) as {
  readonly version: string;
};

process.stdout.write(
  releaseNotes(releases(process.argv[2] ?? 'HEAD'), {
    repoUrl: `https://github.com/${repository}`,
    base: manifest.version,
    tag,
  }),
);
