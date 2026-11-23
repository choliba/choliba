/**
 * The release notes, from data already read from git: the releases (one per release merge on master), the newest open
 * and every older one folded, following Keep a Changelog (version, ISO date, linkable, newest first) and Common
 * Changelog (`**Breaking:**` first in its group, maintenance out of the way). No git and no I/O here, so it can be
 * tested.
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
  /** The `version` in `package.json` at the release merge (`0.1.0`). */
  readonly version: string;
  readonly pullRequest: number | undefined;
  /** The `## Destaques` of the release PR, written for whoever uses choliba. */
  readonly highlights: string | undefined;
  readonly commits: readonly Commit[];
}

export interface NotesContext {
  readonly repoUrl: string;
  /** The tag of the release the notes are published under (`v0.1.0`). */
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
  const [paragraph = ''] = body
    .slice(match.index + match[0].length)
    .split(/\n\s*\n/);
  const text = paragraph.replace(/\s*\n\s*/g, ' ').trim();
  return text === '' ? undefined : text;
}

function parse(commit: Commit): Change | undefined {
  const match = CONVENTIONAL.exec(commit.subject);
  if (match === null) return undefined;
  const [, type = '', scope, bang, description = ''] = match;
  const migration = migrationNote(commit.body);
  return {
    type,
    scope,
    breaking: bang === '!' || migration !== undefined,
    description,
    migration,
  };
}

/** The group a change goes into. */
function groupOf(change: Change | undefined): string {
  if (change === undefined) return OTHERS;
  const open = OPEN_GROUPS.find(([, types]) =>
    types.includes(change.type),
  )?.[0];
  if (open !== undefined) return open;
  if (change.breaking) return CHANGED;
  return (
    INTERNAL_GROUPS.find(([, types]) => types.includes(change.type))?.[0] ??
    OTHERS
  );
}

function commitLink(commit: Commit, repoUrl: string): string {
  return `[${commit.hash.slice(0, 7)}](${repoUrl}/commit/${commit.hash})`;
}

/** The PR a squash title ends with (`… (#41)`), and the title without it. */
function pullRequestOf(
  description: string,
): readonly [string, number | undefined] {
  const match = /^(.*) \(#(\d+)\)$/.exec(description);
  if (match === null) return [description, undefined];
  return [match[1], Number(match[2])];
}

/**
 * One change, as the notes show it under its scope: `**Breaking:**` when it breaks, the PR first (`[#41](…)`), the
 * description and the commit, with the migration quoted under a breaking change.
 */
export function entry(commit: Commit, repoUrl: string): string {
  const change = parse(commit);
  const [description, pullRequest] = pullRequestOf(
    change?.description ?? commit.subject,
  );
  const breaking = change?.breaking === true ? '**Breaking:** ' : '';
  const pr =
    pullRequest === undefined
      ? ''
      : `[#${String(pullRequest)}](${repoUrl}/pull/${String(pullRequest)}) `;
  const line = `${breaking}${pr}${description} (${commitLink(commit, repoUrl)})`;
  return change?.migration === undefined
    ? line
    : `${line}\n> ${change.migration}`;
}

interface Item {
  readonly scope: string | undefined;
  readonly text: string;
}

interface Grouped {
  readonly title: string;
  readonly items: readonly Item[];
}

/** The commits of `titles`' groups, breaking changes first in each, empty groups left out. */
function grouped(
  commits: readonly Commit[],
  titles: readonly string[],
  repoUrl: string,
): readonly Grouped[] {
  const parsed = commits.map((commit) => ({ commit, change: parse(commit) }));
  return titles
    .map((title) => {
      const inGroup = parsed.filter(({ change }) => groupOf(change) === title);
      const ordered = [
        ...inGroup.filter(({ change }) => change?.breaking === true),
        ...inGroup.filter(({ change }) => change?.breaking !== true),
      ];
      return {
        title,
        items: ordered.map(({ commit, change }) => ({
          scope: change?.scope,
          text: entry(commit, repoUrl),
        })),
      };
    })
    .filter(({ items }) => items.length > 0);
}

/** `* text`, indented under a scope, with the lines of a quote kept under it. */
function bullet(text: string, indent: string): string {
  return `${indent}* ${text.replaceAll('\n', `\n${indent}  `)}`;
}

/** A group's items under their scopes (`* \`agents\``), in the order they come, the ones without a scope last. */
function renderItems(items: readonly Item[]): string {
  const scopes = [
    ...new Set(
      items
        .map(({ scope }) => scope)
        .filter((scope): scope is string => scope !== undefined),
    ),
  ];
  const scoped = scopes.map((scope) =>
    [
      `* \`${scope}\``,
      ...items
        .filter((item) => item.scope === scope)
        .map(({ text }) => bullet(text, '  ')),
    ].join('\n'),
  );
  const loose = items
    .filter(({ scope }) => scope === undefined)
    .map(({ text }) => bullet(text, ''));
  return [...scoped, ...loose].join('\n');
}

function render(groups: readonly Grouped[]): string {
  return groups
    .map(({ title, items }) => `#### ${title}\n${renderItems(items)}`)
    .join('\n\n');
}

/** `0.1.0+bbb4cdb`: the version of a release and the commit it was built from. */
export function releaseVersion(release: Release): string {
  return `${release.version}+${release.hash.slice(0, 7)}`;
}

/** `### [0.1.0+bbb4cdb](…/pull/44) (#44)`: the version, linked to the release PR (or to the commit). */
function heading(release: Release, context: NotesContext): string {
  const version = releaseVersion(release);
  if (release.pullRequest === undefined)
    return `### [${version}](${context.repoUrl}/commit/${release.hash})`;
  const pullRequest = String(release.pullRequest);
  return `### [${version}](${context.repoUrl}/pull/${pullRequest}) (#${pullRequest})`;
}

function compare(release: Release, repoUrl: string): string {
  const range = `${release.previous.slice(0, 7)}...${release.hash.slice(0, 7)}`;
  return `**Commits:** [\`${range}\`](${repoUrl}/compare/${release.previous}...${release.hash})`;
}

function folded(summary: string, content: string): string {
  return `<details>\n<summary>${summary}</summary>\n\n${content}\n\n</details>`;
}

/** One release: its heading, highlights, open groups, the internal ones folded, and the compare link. */
export function releaseSection(
  release: Release,
  context: NotesContext,
): string {
  const open = render(
    grouped(
      release.commits,
      [...OPEN_GROUPS.map(([title]) => title), OTHERS],
      context.repoUrl,
    ),
  );
  const internal = grouped(
    release.commits,
    INTERNAL_GROUPS.map(([title]) => title),
    context.repoUrl,
  );
  const internalCount = internal.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );
  const names = internal.map(({ title }) => title.toLowerCase()).join(', ');
  return [
    heading(release, context),
    release.highlights,
    open === '' ? undefined : open,
    internalCount === 0
      ? undefined
      : folded(
          `Interno: ${names} (${String(internalCount)})`,
          render(internal),
        ),
    compare(release, context.repoUrl),
  ]
    .filter((part): part is string => part !== undefined && part !== '')
    .join('\n\n');
}

/** The whole notes: how to install, the newest release open and every older one folded under its date. */
export function releaseNotes(
  releases: readonly Release[],
  context: NotesContext,
): string {
  const asset = `choliba-${context.tag.replace(/^v/, '')}.tgz`;
  const latest = releases.at(0);
  const older = releases.slice(1);
  const current =
    latest === undefined
      ? []
      : [
          `**Versão atual: \`${releaseVersion(latest)}\`**, de ${latest.date}. O \`${asset}\` em **Assets**, no fim`,
          'da página, é desta versão.',
          '',
        ];
  const intro = [
    ...current,
    'Pré-release atualizada a cada merge na `master`; o endereço de instalação não muda e traz sempre a versão atual:',
    '',
    '```',
    `bun add --trust ${context.repoUrl}/releases/download/${context.tag}/${asset}`,
    '```',
  ].join('\n');
  const sections = [
    ...(latest === undefined
      ? []
      : [`## ${latest.date}\n\n${releaseSection(latest, context)}`]),
    ...older.map((release) =>
      folded(
        `${release.date} · ${release.version}`,
        releaseSection(release, context),
      ),
    ),
  ];
  return `${[intro, ...sections].join('\n\n')}\n`;
}

/** The `## Destaques` section of a release PR body, up to the next `## ` heading; `undefined` when it has none. */
export function highlightsOf(body: string): string | undefined {
  const match = /^## Destaques[ \t]*$/m.exec(body);
  if (match === null) return undefined;
  const [section = ''] = body
    .slice(match.index + match[0].length)
    .split(/^## /m);
  const text = section.trim();
  return text === '' ? undefined : text;
}
