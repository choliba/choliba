import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { releaseNumber, versionNotes, whatIsNew } from '../../update/release-notes';

/** Three versions of a real release body, newest first: 62, 61 (with an internal block) and 60, in a block of older ones. */
const BODY = readFileSync(join(__dirname, 'fixtures', 'release-body.md'), 'utf8');

const bold = (text: string): string => `\u001b[1m${text}\u001b[22m`;

describe('releaseNumber', () => {
  it('reads the N of a version, with or without its commit, and of a release title', () => {
    expect([
      releaseNumber('0.0.1-dev.62+27dbedb'),
      releaseNumber('0.0.1-dev.7'),
      releaseNumber('0.0.1-dev.62 (2026-10-15)'),
    ]).toEqual([62, 7, 62]);
  });

  it('has none for a version of no release: the sources, a local package, another channel', () => {
    expect([releaseNumber('0.0.1-dev'), releaseNumber('1.2.3'), releaseNumber('')]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('versionNotes', () => {
  it('finds each version of the body, newest first, with its pull request and the lines under it', () => {
    const notes = versionNotes(BODY);

    expect(notes.map((each) => [each.version, each.number, each.suffix])).toEqual([
      ['0.0.1-dev.62+27dbedb', 62, ' (#207)'],
      ['0.0.1-dev.61+787a582', 61, ' (#204)'],
      ['0.0.1-dev.60+c4d4ca7', 60, ' (#199)'],
    ]);
    expect(notes[0]?.lines.find((line) => line.startsWith('Um script'))).toContain("import { choliba } from 'choliba'");
  });

  it('leaves out what comes before the first version, and reads a body with CRLF line ends', () => {
    const notes = versionNotes('intro\r\n\r\n### [0.0.1-dev.3+abc1234](u) (#3)\r\nfeito\r\n');

    expect(notes).toEqual([{ version: '0.0.1-dev.3+abc1234', number: 3, suffix: ' (#3)', lines: ['feito', ''] }]);
  });
});

describe('whatIsNew', () => {
  it('lists the versions newer than the installed one, as terminal text, newest first', () => {
    const news = whatIsNew(BODY, 60, bold);

    expect(news.filter((line) => line.startsWith('\u001b[1m0.0.1'))).toEqual([
      `${bold('0.0.1-dev.62+27dbedb')} (#207)`,
      `${bold('0.0.1-dev.61+787a582')} (#204)`,
    ]);
    expect(news).toContain(`  ${bold('Novidades')}`);
    expect(news).toContain('  · choliba');
    expect(news).toContain('    · #206 add projects, tickets and tests to the facade (3bf0e46)');
    expect(news.some((line) => line.includes('Commits:') || line.includes('](') || line.includes('`'))).toBe(false);
    expect(news.at(-1)).toBe('');
  });

  it('leaves out the internal blocks and the HTML of the collapsed ones, keeping the versions inside them', () => {
    const news = whatIsNew(BODY, 59, bold);

    expect(news.some((line) => /Interno|Refatoração|<\/?(details|summary)>|2026-10-14/.test(line))).toBe(false);
    expect(news).toContain(`${bold('0.0.1-dev.60+c4d4ca7')} (#199)`);
    expect(news.filter((line, index) => line === '' && news[index - 1] === '')).toEqual([]);
  });

  it('writes no escape code when the output takes no color', () => {
    expect(whatIsNew(BODY, 61, (text) => text)[0]).toBe('0.0.1-dev.62+27dbedb (#207)');
  });

  it('has nothing when the installed version is the newest, and everything for an unknown one', () => {
    expect(whatIsNew(BODY, 62, bold)).toEqual([]);
    expect(whatIsNew(BODY, -1, bold).filter((line) => line.startsWith('\u001b[1m0.0.1'))).toHaveLength(3);
  });

  it('shows a version with nothing under it as its heading alone', () => {
    expect(whatIsNew('### [0.0.1-dev.4](u)\n\n**Commits:** x\n', 3, bold)).toEqual([bold('0.0.1-dev.4'), '']);
  });
});
