import fs from 'node:fs';
import path from 'node:path';

/** `README`, `README.md`, `readme.txt`…: the files at a folder's root named README, in any case, `.md` first. */
export function findReadme(dir: string): string | undefined {
  const isMarkdown = (name: string): number => (name.toLowerCase().endsWith('.md') ? 0 : 1);
  const [first] = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^readme(\.[a-z]+)?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => isMarkdown(a) - isMarkdown(b) || a.localeCompare(b));
  return first === undefined ? undefined : path.join(dir, first);
}

/** A text file as UTF-8, or as Latin-1 when it is not valid UTF-8 (older repositories often are). */
export function readText(file: string): string {
  const bytes = fs.readFileSync(file);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

/** Markdown reduced to plain text: images out, links to their text, code/bold/italic marks out. */
function plain(text: string): string {
  return text
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/`|\*\*|__/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/** Lines that open no paragraph: headings, lists, tables, quotes, HTML, rules. */
const NOT_PROSE = /^(#|[-*+]\s|\d+[.)]\s|\||>|<|---|\*\*\*|===)/;

const MAX_LENGTH = 400;

/** At most `MAX_LENGTH` characters, cut after the last sentence that fits, or at a word with `…`. */
function shorten(text: string): string {
  if (text.length <= MAX_LENGTH) {
    return text;
  }
  const cut = text.slice(0, MAX_LENGTH);
  const sentenceEnd = cut.lastIndexOf('. ');
  return sentenceEnd > 0 ? cut.slice(0, sentenceEnd + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/**
 * What a project is, from its README: the first `# ` title and the first paragraph of prose after
 * it (badges, headings, lists, tables and code blocks are skipped), as `Title: paragraph`. Either
 * alone when the other is missing; `undefined` when there is neither.
 */
export function readmeSummary(markdown: string): string | undefined {
  let title: string | undefined;
  let paragraph: string[] = [];
  let inCode = false;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      continue;
    }
    const heading = /^#\s+(.+)$/.exec(line)?.[1];
    if (title === undefined && heading !== undefined) {
      title = plain(heading);
      continue;
    }
    if (line === '' || NOT_PROSE.test(line) || plain(line) === '') {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }
    paragraph = [...paragraph, line];
  }
  const text = plain(paragraph.join(' '));
  const summary = [title, text].filter((part) => part !== undefined && part !== '').join(': ');
  return summary === '' ? undefined : shorten(summary);
}
