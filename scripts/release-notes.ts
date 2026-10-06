/**
 * Notas da pré-release: uma seção por merge de release na master (o mais novo primeiro), com os commits que cada
 * um trouxe da develop agrupados por tipo do Conventional Commits. Uso: `bun scripts/release-notes.ts [COMMIT]`
 * (padrão HEAD); o CI passa `GITHUB_REPOSITORY` e `TAG`.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');
const repository = process.env['GITHUB_REPOSITORY'] ?? 'jacksonbicalho/choliba';
const tag = process.env['TAG'] ?? 'v0.0.1-dev';
const repoUrl = `https://github.com/${repository}`;

/** Separa os campos de um `git log --format` (o caractere de controle US não aparece em mensagens). */
const FIELD = '\x1f';

/** As seções, na ordem em que aparecem, e os tipos de commit de cada uma. */
const SECTIONS: readonly (readonly [string, readonly string[]])[] = [
  ['Novidades', ['feat']],
  ['Correções', ['fix']],
  ['Performance', ['perf']],
  ['Refatoração', ['refactor']],
  ['Docs', ['docs']],
  ['Testes', ['test']],
  ['Manutenção', ['chore', 'build', 'ci', 'style', 'revert']],
];
/** A seção dos assuntos fora do Conventional Commits. */
const OTHERS = 'Outros';

/** `tipo(escopo)!: descrição`, com escopo e `!` opcionais. */
const CONVENTIONAL = /^([a-z]+)(?:\(([^)]+)\))?(!)?: (.+)$/;

interface Commit {
  readonly hash: string;
  readonly subject: string;
}

interface Release {
  readonly hash: string;
  readonly previous: string;
  readonly date: string;
  readonly pullRequest: string | undefined;
  readonly commits: readonly Commit[];
}

function git(args: readonly string[]): string {
  const result = spawnSync('git', [...args], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} falhou: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function lines(output: string): readonly string[] {
  return output.split('\n').filter((line) => line !== '');
}

/** Os commits que o merge `hash` trouxe: os do segundo pai que o primeiro ainda não tinha, sem merges. */
function mergedCommits(previous: string, merged: string): readonly Commit[] {
  return lines(git(['log', '--no-merges', `--format=%H${FIELD}%s`, `${previous}..${merged}`])).map((line) => {
    const [hash = '', subject = ''] = line.split(FIELD);
    return { hash, subject };
  });
}

/** Cada merge de primeiro pai até `commit`: as releases, a mais nova primeiro. */
function releases(commit: string): readonly Release[] {
  const format = ['%H', '%P', '%ad', '%s'].join(FIELD);
  const merges = git(['log', '--first-parent', '--merges', '--date=short', `--format=${format}`, commit]);
  return lines(merges).map((line) => {
    const [hash = '', parents = '', date = '', subject = ''] = line.split(FIELD);
    const [previous = '', merged = ''] = parents.split(' ');
    const pullRequest = /^Merge pull request #(\d+)/.exec(subject)?.[1];
    return { hash, previous, date, pullRequest, commits: mergedCommits(previous, merged) };
  });
}

/** O item de um commit e a seção em que ele entra. */
function entry(commit: Commit): readonly [string, string] {
  const short = commit.hash.slice(0, 7);
  const match = CONVENTIONAL.exec(commit.subject);
  if (match === null) {
    return [OTHERS, `- ${commit.subject} (\`${short}\`)`];
  }
  const [, type = '', scope, breaking, description = ''] = match;
  const section = SECTIONS.find(([, types]) => types.includes(type))?.[0] ?? OTHERS;
  const prefix = scope === undefined ? '' : `**${scope}**: `;
  const suffix = breaking === undefined ? '' : ' **BREAKING**';
  return [section, `- ${prefix}${description}${suffix} (\`${short}\`)`];
}

/** As seções de uma release, na ordem de `SECTIONS`, sem as vazias. */
function sections(commits: readonly Commit[]): readonly string[] {
  const entries = commits.map(entry);
  return [...SECTIONS.map(([title]) => title), OTHERS]
    .map((title) => [title, entries.filter(([section]) => section === title).map(([, item]) => item)] as const)
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => [`### ${title}`, ...items].join('\n'));
}

function heading(release: Release): string {
  const short = release.hash.slice(0, 7);
  const label =
    release.pullRequest === undefined
      ? `[\`${short}\`](${repoUrl}/commit/${release.hash})`
      : `[#${release.pullRequest}](${repoUrl}/pull/${release.pullRequest})`;
  return `## ${release.date} — ${label}`;
}

function compare(release: Release): string {
  const range = `${release.previous.slice(0, 7)}...${release.hash.slice(0, 7)}`;
  return `**Commits:** [\`${range}\`](${repoUrl}/compare/${release.previous}...${release.hash})`;
}

function notes(commit: string): string {
  const intro = [
    'Pré-release atualizada a cada merge na `master`. Para instalar:',
    '',
    '```',
    `bun add ${repoUrl}/releases/download/${tag}/choliba-${tag.replace(/^v/, '')}.tgz`,
    '```',
  ].join('\n');
  const history = releases(commit).map((release) =>
    [heading(release), ...sections(release.commits), compare(release)].join('\n\n'),
  );
  return [intro, ...history].join('\n\n') + '\n';
}

process.stdout.write(notes(process.argv[2] ?? 'HEAD'));
