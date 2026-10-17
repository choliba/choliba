/** The development channel's versions: `0.0.1-dev.N`, N counting the releases. */
const DEV_VERSION = /^0\.0\.1-dev\.(\d+)/;

/** The heading of one version in the release body: `### [0.0.1-dev.62+27dbedb](…/pull/207) (#207)`. */
const VERSION_HEADING = /^### \[(0\.0\.1-dev\.(\d+)(?:\+[0-9a-f]+)?)\]\([^)]*\)(.*)$/;

/** How a heading stands out: bold on a terminal that takes color, as it is elsewhere. */
export type Emphasis = (text: string) => string;

/** A collapsed block of the body: `<summary>Interno: …` is internal work, any other summary groups older versions. */
const SUMMARY = /^<summary>(.*)<\/summary>$/;

/** The N of a version (`0.0.1-dev.62+27dbedb`, or a release title `0.0.1-dev.62 (2026-10-15)`); none for another. */
export function releaseNumber(version: string): number | undefined {
  const match = DEV_VERSION.exec(version);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** One version's notes in the release body: its version, its pull request, and its lines as written. */
export interface VersionNotes {
  readonly version: string;
  readonly number: number;
  /** What follows the link in the heading: ` (#207)`, or nothing. */
  readonly suffix: string;
  readonly lines: readonly string[];
}

/**
 * The body's lines a person reads: no `<details>` tags, and no internal block (`<summary>Interno: …`), skipped up to
 * its `</details>`. The summary of a block of older versions becomes a heading, which closes the version before it.
 */
function readableLines(body: string): readonly string[] {
  const lines: string[] = [];
  let internal = false;
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const summary = SUMMARY.exec(line.trim())?.[1];
    if (internal) internal = line.trim() !== '</details>';
    else if (summary?.startsWith('Interno') === true) internal = true;
    else if (summary !== undefined) lines.push(`## ${summary}`);
    else if (line.trim() !== '<details>' && line.trim() !== '</details>') lines.push(line);
  }
  return lines;
}

/** The versions the body describes, newest first as it lists them, with the lines under each heading. */
export function versionNotes(body: string): readonly VersionNotes[] {
  const notes: { version: string; number: number; suffix: string; lines: string[] }[] = [];
  for (const line of readableLines(body)) {
    const heading = VERSION_HEADING.exec(line);
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      notes.push({ version: heading[1], number: Number(heading[2]), suffix: heading[3] ?? '', lines: [] });
    } else if (line.startsWith('## ')) {
      // A date heading closes the version before it.
      notes.push({ version: '', number: -1, suffix: '', lines: [] });
    } else {
      notes.at(-1)?.lines.push(line);
    }
  }
  return notes.filter((each) => each.number >= 0);
}

/** A markdown line as plain terminal text: links as their text, no `**` nor backticks, a `####` title emphasized. */
function plainLine(line: string, bold: Emphasis): string {
  const text = line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1');
  return text.startsWith('#### ') ? bold(text.slice(5)) : text.replace(/^(\s*)\* /, '$1· ');
}

/** The lines kept: no line of commits (`**Commits:** …`), one blank line at most in a row, none at the start or end. */
function keptLines(lines: readonly string[]): readonly string[] {
  const kept = lines
    .filter((line) => !line.startsWith('**Commits:**'))
    .filter((line, index, all) => line.trim() !== '' || all[index - 1]?.trim() !== '');
  const first = kept.findIndex((line) => line.trim() !== '');
  const last = kept.findLastIndex((line) => line.trim() !== '');
  return first === -1 ? [] : kept.slice(first, last + 1);
}

/**
 * What is new since version `since` (its N), for the terminal: each newer version's heading emphasized with `bold`, its
 * pull request after it, and its lines indented under it, newest first. Empty when the body has nothing newer.
 */
export function whatIsNew(body: string, since: number, bold: Emphasis): readonly string[] {
  return versionNotes(body)
    .filter((each) => each.number > since)
    .flatMap((each) => [
      `${bold(each.version)}${plainLine(each.suffix, bold)}`,
      ...keptLines(each.lines).map((line) => (line.trim() === '' ? '' : `  ${plainLine(line, bold)}`)),
      '',
    ]);
}
