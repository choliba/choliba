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
  it('puts the PR of a squash title first, then the description and the commit', () => {
    expect(entry(commit('fix(setup): keep the .env (#41)'), REPO)).toBe(`[#41](${REPO}/pull/41) keep the .env ${LINK}`);
    expect(entry(commit('docs: explain it'), REPO)).toBe(`explain it ${LINK}`);
  });

  it('marks a breaking change, from the ! or the footer, with the migration quoted under it', () => {
    expect(entry(commit('feat(agents)!: drop x'), REPO)).toBe(`**Breaking:** drop x ${LINK}`);
    expect(entry(commit('refactor: move y', 'BREAKING CHANGE: move your y.'), REPO)).toBe(
      `**Breaking:** move y ${LINK}\n> move your y.`,
    );
  });

  it('keeps a subject outside Conventional Commits as it is', () => {
    expect(entry(commit('Update README (#3)'), REPO)).toBe(`[#3](${REPO}/pull/3) Update README ${LINK}`);
  });
});

describe('releaseVersion', () => {
  it('is what choliba --version prints for that build: base, release number and commit', () => {
    expect(releaseVersion(release(), '0.0.1-dev')).toBe('0.0.1-dev.16+bbbbbbb');
  });
});

describe('releaseSection', () => {
  it('opens with the version and its PR, then the highlights, the groups in order and the compare link', () => {
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
    const titles = [...section.matchAll(/^#{3,4} .+$/gm)].map(([line]) => line);

    expect(titles).toEqual([
      `### [0.0.1-dev.16+bbbbbbb](${REPO}/pull/46) (#46)`,
      '#### Novidades',
      '#### Correções',
      '#### Alterações',
      '#### Desempenho',
      '#### Documentação',
      '#### Outros',
    ]);
    expect(section).toContain(
      `(#46)\n\nO choliba agora mostra a versão.\n\n#### Novidades\n* \`x\`\n  * **Breaking:** d`,
    );
    expect(section).toContain('#### Alterações\n* **Breaking:** f');
    expect(section).not.toContain('<details>');
    expect(section).toMatch(/\*\*Commits:\*\* \[`ccccccc\.\.\.bbbbbbb`\]\(.+\/compare\/c+\.\.\.b+\)$/);
  });

  it('folds refactoring, tests and maintenance, and links a release without a PR to its commit', () => {
    const section = releaseSection(
      release({ pullRequest: undefined, commits: [commit('ci: a'), commit('test: b'), commit('refactor: c')] }),
      CONTEXT,
    );

    expect(section).toContain(`### [0.0.1-dev.16+bbbbbbb](${REPO}/commit/${'b'.repeat(40)})\n`);
    expect(section).toContain('<summary>Interno: refatoração, testes, manutenção (3)</summary>');
    expect(section).toContain('#### Refatoração\n* c');
    expect(section).not.toMatch(/^#### (Novidades|Correções)/m);
  });
});

describe('releaseSection, items', () => {
  it('lists the items of a group under their scopes, in order, the ones without a scope last', () => {
    const section = releaseSection(
      release({
        commits: [
          commit('fix(cli): a (#1)'),
          commit('fix: b'),
          commit('fix(setup): c'),
          commit('fix(cli)!: d', 'BREAKING CHANGE: migre.'),
        ],
      }),
      CONTEXT,
    );

    expect(section).toContain(
      [
        '#### Correções',
        '* `cli`',
        `  * **Breaking:** d ${LINK}`,
        '    > migre.',
        `  * [#1](${REPO}/pull/1) a ${LINK}`,
        '* `setup`',
        `  * c ${LINK}`,
        `* b ${LINK}`,
      ].join('\n'),
    );
  });
});

describe('releaseNotes', () => {
  const day = (date: string, ...numbers: number[]): readonly Release[] =>
    numbers.map((number) => release({ date, number, pullRequest: number }));

  it('shows how to install, then the releases by day: the newest day open, every older day folded', () => {
    const notes = releaseNotes(
      [...day('2026-10-07', 17, 16), ...day('2026-10-06', 15, 14, 13), ...day('2026-10-04', 12)],
      CONTEXT,
    );
    const outline = [...notes.matchAll(/^(?:## .+|### \[[^\]]+\]|<summary>.+<\/summary>)/gm)].map(([line]) => line);

    expect(notes.startsWith('**Versão atual: `0.0.1-dev.17+bbbbbbb`**, de 2026-10-07.')).toBe(true);
    expect(notes).toContain('O `choliba-0.0.1-dev.tgz` em **Assets**');
    expect(notes).toContain(`bun add --trust ${REPO}/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz`);
    expect(outline).toEqual([
      '## 2026-10-07',
      '### [0.0.1-dev.17+bbbbbbb]',
      '### [0.0.1-dev.16+bbbbbbb]',
      '<summary>2026-10-06 · 0.0.1-dev.13 a 0.0.1-dev.15</summary>',
      '### [0.0.1-dev.15+bbbbbbb]',
      '### [0.0.1-dev.14+bbbbbbb]',
      '### [0.0.1-dev.13+bbbbbbb]',
      '<summary>2026-10-04 · 0.0.1-dev.12</summary>',
      '### [0.0.1-dev.12+bbbbbbb]',
    ]);
    expect(notes.endsWith('</details>\n')).toBe(true);
  });

  it('names the two versions of a two-release day, and has only the introduction with no release', () => {
    const notes = releaseNotes([...day('2026-10-07', 3), ...day('2026-10-06', 2, 1)], CONTEXT);

    expect(notes).toContain('<summary>2026-10-06 · 0.0.1-dev.1 e 0.0.1-dev.2</summary>');
    expect(releaseNotes([], CONTEXT)).not.toMatch(/## |Versão atual/);
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
