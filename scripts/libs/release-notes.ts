/**
 * The release notes, from data already read from git: one section per release merge on master, the newest open and
 * the older ones folded, following Keep a Changelog (version, ISO date, linkable, newest first) and Common Changelog
 * (`**Breaking:**` first in its group, maintenance out of the way). No git and no I/O here, so it can be tested.
 */

export interface Commit {
  readonly hash: string;
  readonly subject: string;
  readonly body: string;
}

export interface Release {
  readonly hash: string;
  readonly previous: string;
  readonly date: string;
  /** The release number: how many release merges master has up to this one (`0.0.1-dev.<number>`). */
  readonly number: number;
  readonly pullRequest: number | undefined;
  /** The `## Destaques` of the release PR, written for whoever uses choliba. */
  readonly highlights: string | undefined;
  readonly commits: readonly Commit[];
}

export interface NotesContext {
  readonly repoUrl: string;
  /** The base of every version, `packages/choliba/package.json` (`0.0.1-dev`). */
  readonly base: string;
  readonly tag: string;
}

interface Change {
  readonly type: string;
  readonly scope: string | undefined;
  readonly breaking: boolean;
  readonly description: string;
  /** The `BREAKING CHANGE:` footer: what breaks and how to migrate. */
  readonly migration: string | undefined;
}

/** The groups shown open, in order, and the types each takes (a breaking change of any other type is "Alterações"). */
const OPEN_GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ['Novidades', ['feat']],
  ['Correções', ['fix']],
  ['Alterações', []],
  ['Desempenho', ['perf']],
  ['Documentação', ['docs']],
];
/** The groups folded under "Interno": work that does not change what choliba does for whoever uses it. */
const INTERNAL_GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ['Refatoração', ['refactor']],
  ['Testes', ['test']],
  ['Manutenção', ['chore', 'build', 'ci', 'style', 'revert']],
];
const CHANGED = 'Alterações';
/** Subjects outside Conventional Commits: shown, since nothing says they are internal. */
const OTHERS = 'Outros';

const CONVENTIONAL = /^([a-z]+)(?:\(([^)]+)\))?(!)?: (.+)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: ?/m;

/** The `BREAKING CHANGE:` footer of a commit body, up to the first blank line, joined into one paragraph. */
export function migrationNote(body: string): string | undefined {
  const match = BREAKING_FOOTER.exec(body);
  if (match === null) return undefined;
  const [paragraph = ''] = body.slice(match.index + match[0].length).split(/\n\s*\n/);
  const text = paragraph.replace(/\s*\n\s*/g, ' ').trim();
  return text === '' ? undefined : text;
}

function parse(commit: Commit): Change | undefined {
  const match = CONVENTIONAL.exec(commit.subject);
  if (match === null) return undefined;
  const [, type = '', scope, bang, description = ''] = match;
  const migration = migrationNote(commit.body);
  return { type, scope, breaking: bang !== undefined || migration !== undefined, description, migration };
}

/** The group a change goes into. */
function groupOf(change: Change | undefined): string {
  if (change === undefined) return OTHERS;
  const open = OPEN_GROUPS.find(([, types]) => types.includes(change.type))?.[0];
  if (open !== undefined) return open;
  if (change.breaking) return CHANGED;
  return INTERNAL_GROUPS.find(([, types]) => types.includes(change.type))?.[0] ?? OTHERS;
}

function commitLink(commit: Commit, repoUrl: string): string {
  return `[${commit.hash.slice(0, 7)}](${repoUrl}/commit/${commit.hash})`;
}

/** One line of the notes, with the migration as a quote under a breaking change. */
export function entry(commit: Commit, repoUrl: string): string {
  const change = parse(commit);
  const link = commitLink(commit, repoUrl);
  if (change === undefined) return `- ${commit.subject} (${link})`;
  const breaking = change.breaking ? '**Breaking:** ' : '';
  const scope = change.scope === undefined ? '' : `**${change.scope}**: `;
  const line = `- ${breaking}${scope}${change.description} (${link})`;
  return change.migration === undefined ? line : `${line}\n  > ${change.migration}`;
}

interface Grouped {
  readonly title: string;
  readonly entries: readonly string[];
}

/** The commits of `titles`' groups, breaking changes first in each, empty groups left out. */
function grouped(commits: readonly Commit[], titles: readonly string[], repoUrl: string): readonly Grouped[] {
  const parsed = commits.map((commit) => ({ commit, change: parse(commit) }));
  return titles
    .map((title) => {
      const inGroup = parsed.filter(({ change }) => groupOf(change) === title);
      const ordered = [
        ...inGroup.filter(({ change }) => change?.breaking === true),
        ...inGroup.filter(({ change }) => change?.breaking !== true),
      ];
      return { title, entries: ordered.map(({ commit }) => entry(commit, repoUrl)) };
    })
    .filter(({ entries }) => entries.length > 0);
}

function render(groups: readonly Grouped[]): string {
  return groups.map(({ title, entries }) => [`### ${title}`, ...entries].join('\n')).join('\n\n');
}

/** `0.0.1-dev.15+bbb4cdb`: what `choliba --version` prints for the build of this release. */
export function releaseVersion(release: Release, base: string): string {
  return `${base}.${String(release.number)}+${release.hash.slice(0, 7)}`;
}

function heading(release: Release, context: NotesContext): string {
  const target =
    release.pullRequest === undefined
      ? `${context.repoUrl}/commit/${release.hash}`
      : `${context.repoUrl}/pull/${String(release.pullRequest)}`;
  return `## [${releaseVersion(release, context.base)}](${target}) - ${release.date}`;
}

function compare(release: Release, repoUrl: string): string {
  const range = `${release.previous.slice(0, 7)}...${release.hash.slice(0, 7)}`;
  return `**Commits:** [\`${range}\`](${repoUrl}/compare/${release.previous}...${release.hash})`;
}

function folded(summary: string, content: string): string {
  return `<details>\n<summary>${summary}</summary>\n\n${content}\n\n</details>`;
}

/** One release: its heading, highlights, open groups, the internal ones folded, and the compare link. */
export function releaseSection(release: Release, context: NotesContext): string {
  const open = render(grouped(release.commits, [...OPEN_GROUPS.map(([title]) => title), OTHERS], context.repoUrl));
  const internal = grouped(
    release.commits,
    INTERNAL_GROUPS.map(([title]) => title),
    context.repoUrl,
  );
  const internalCount = internal.reduce((sum, group) => sum + group.entries.length, 0);
  const names = internal.map(({ title }) => title.toLowerCase()).join(', ');
  return [
    heading(release, context),
    release.highlights,
    open === '' ? undefined : open,
    internalCount === 0 ? undefined : folded(`Interno: ${names} (${String(internalCount)})`, render(internal)),
    compare(release, context.repoUrl),
  ]
    .filter((part): part is string => part !== undefined && part !== '')
    .join('\n\n');
}

/** The whole notes: how to install, the newest release open and every older one folded. */
export function releaseNotes(releases: readonly Release[], context: NotesContext): string {
  const asset = `choliba-${context.tag.replace(/^v/, '')}.tgz`;
  const intro = [
    'Pré-release atualizada a cada merge na `master`. Para instalar:',
    '',
    '```',
    `bun add --trust ${context.repoUrl}/releases/download/${context.tag}/${asset}`,
    '```',
    '',
    'A versão instalada (`bunx choliba --version`) é a do título de cada atualização abaixo.',
  ].join('\n');
  const [latest, ...older] = releases;
  const sections = [
    intro,
    latest === undefined ? undefined : releaseSection(latest, context),
    older.length === 0
      ? undefined
      : folded(
          `Atualizações anteriores (${String(older.length)})`,
          older.map((release) => releaseSection(release, context)).join('\n\n'),
        ),
  ];
  return `${sections.filter((section): section is string => section !== undefined).join('\n\n')}\n`;
}

/** The `## Destaques` section of a release PR body, up to the next `## ` heading; `undefined` when it has none. */
export function highlightsOf(body: string): string | undefined {
  const match = /^## Destaques[ \t]*$/m.exec(body);
  if (match === null) return undefined;
  const [section = ''] = body.slice(match.index + match[0].length).split(/^## /m);
  const text = section.trim();
  return text === '' ? undefined : text;
}
