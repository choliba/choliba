import {
  entry,
  highlightsOf,
  migrationNote,
  releaseNotes,
  releaseSection,
  releaseVersion,
  type Commit,
  type Release,
} from '../libs/release-notes';

const REPO = 'https://github.com/dono/repo';
const CONTEXT = { repoUrl: REPO, base: '0.0.1-dev', tag: 'v0.0.1-dev' };

function commit(subject: string, body = '', hash = 'a'.repeat(40)): Commit {
  return { hash, subject, body };
}

function release(overrides: Partial<Release> = {}): Release {
  return {
    hash: 'b'.repeat(40),
    previous: 'c'.repeat(40),
    date: '2026-10-07',
    number: 16,
    pullRequest: 46,
    highlights: undefined,
    commits: [],
    ...overrides,
  };
}

const LINK = `([aaaaaaa](${REPO}/commit/${'a'.repeat(40)}))`;

describe('migrationNote', () => {
  it('is the BREAKING CHANGE footer up to the first blank line, as one paragraph', () => {
    const body = 'Why it changed.\n\nBREAKING CHANGE: epic is no longer\na ticket type.\n\nRefs: #11';
    expect(migrationNote(body)).toBe('epic is no longer a ticket type.');
    expect(migrationNote('BREAKING-CHANGE: same thing')).toBe('same thing');
  });

  it('is nothing without the footer, or with an empty one', () => {
    expect(migrationNote('Just a body.')).toBeUndefined();
    expect(migrationNote('BREAKING CHANGE:\n\nmore')).toBeUndefined();
  });
});

describe('entry', () => {
  it('writes the scope in bold, the description and a link to the commit', () => {
    expect(entry(commit('fix(setup): keep the .env'), REPO)).toBe(`- **setup**: keep the .env ${LINK}`);
    expect(entry(commit('docs: explain it'), REPO)).toBe(`- explain it ${LINK}`);
  });

  it('marks a breaking change, from the ! or the footer, with the migration quoted under it', () => {
    expect(entry(commit('feat(agents)!: drop x'), REPO)).toBe(`- **Breaking:** **agents**: drop x ${LINK}`);
    expect(entry(commit('refactor: move y', 'BREAKING CHANGE: move your y.'), REPO)).toBe(
      `- **Breaking:** move y ${LINK}\n  > move your y.`,
    );
  });

  it('keeps a subject outside Conventional Commits as it is', () => {
    expect(entry(commit('Update README'), REPO)).toBe(`- Update README ${LINK}`);
  });
});

describe('releaseVersion', () => {
  it('is what choliba --version prints for that build: base, release number and commit', () => {
    expect(releaseVersion(release(), '0.0.1-dev')).toBe('0.0.1-dev.16+bbbbbbb');
  });
});

describe('releaseSection', () => {
  it('opens with the version and date, then the highlights, the groups in order and the compare link', () => {
    const section = releaseSection(
      release({
        highlights: 'O choliba agora mostra a versão.',
        commits: [
          commit('docs: a'),
          commit('fix: b'),
          commit('feat: c'),
          commit('feat(x)!: d'),
          commit('perf: e'),
          commit('chore!: f'),
          commit('Merge-free subject'),
        ],
      }),
      CONTEXT,
    );
    const titles = [...section.matchAll(/^#{2,3} .+$/gm)].map(([line]) => line);

    expect(titles).toEqual([
      `## [0.0.1-dev.16+bbbbbbb](${REPO}/pull/46) - 2026-10-07`,
      '### Novidades',
      '### Correções',
      '### Alterações',
      '### Desempenho',
      '### Documentação',
      '### Outros',
    ]);
    expect(section).toContain(
      `2026-10-07\n\nO choliba agora mostra a versão.\n\n### Novidades\n- **Breaking:** **x**: d`,
    );
    expect(section).toContain('### Alterações\n- **Breaking:** f');
    expect(section).not.toContain('<details>');
    expect(section).toMatch(/\*\*Commits:\*\* \[`ccccccc\.\.\.bbbbbbb`\]\(.+\/compare\/c+\.\.\.b+\)$/);
  });

  it('folds refactoring, tests and maintenance, and links a release without a PR to its commit', () => {
    const section = releaseSection(
      release({ pullRequest: undefined, commits: [commit('ci: a'), commit('test: b'), commit('refactor: c')] }),
      CONTEXT,
    );

    expect(section).toContain(`## [0.0.1-dev.16+bbbbbbb](${REPO}/commit/${'b'.repeat(40)}) - 2026-10-07`);
    expect(section).toContain('<summary>Interno: refatoração, testes, manutenção (3)</summary>');
    expect(section).toContain('### Refatoração\n- c');
    expect(section).not.toMatch(/^### (Novidades|Correções)/m);
  });
});

describe('releaseNotes', () => {
  it('shows how to install, the newest release open and the older ones folded', () => {
    const notes = releaseNotes([release({ number: 16 }), release({ number: 15 }), release({ number: 14 })], CONTEXT);

    expect(notes).toContain(`bun add --trust ${REPO}/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz`);
    expect(notes.indexOf('0.0.1-dev.16+')).toBeLessThan(notes.indexOf('<summary>Atualizações anteriores (2)'));
    expect(notes.indexOf('<summary>Atualizações anteriores (2)')).toBeLessThan(notes.indexOf('0.0.1-dev.15+'));
    expect(notes.endsWith('</details>\n')).toBe(true);
  });

  it('has no folded part with a single release, and only the introduction with none', () => {
    expect(releaseNotes([release()], CONTEXT)).not.toContain('Atualizações anteriores');
    expect(releaseNotes([], CONTEXT)).not.toContain('## ');
  });
});

describe('highlightsOf', () => {
  it('is the "## Destaques" section of a release PR, up to the next heading', () => {
    const body = '## Release v0.0.1-dev\n\nx\n\n## Destaques\n\nUma frase.\nOutra.\n\n## What goes in\n\n- y';
    expect(highlightsOf(body)).toBe('Uma frase.\nOutra.');
    expect(highlightsOf('## Destaques\n\nSó isso.\n')).toBe('Só isso.');
  });

  it('is nothing without the section, or with an empty one', () => {
    expect(highlightsOf('## What goes in\n\n- y')).toBeUndefined();
    expect(highlightsOf('## Destaques\n\n## What goes in')).toBeUndefined();
  });
});
