import type { CommandEntry, CommandSpec, FlagChoice, FlagSpec } from './interfaces/help.interface';

/** Every line of `--help` fits in this many columns (a word longer than that stays whole). */
export const HELP_WIDTH = 80;

/** Greedy word wrap; never breaks a word. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length > width && current !== '') {
      lines.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }
  lines.push(current);
  return lines;
}

/**
 * A line wider than `HELP_WIDTH`, wrapped under its own indentation: an indented line (an example) keeps it, and
 * its continuations go two columns further, so they read as part of it.
 */
function wrapIndented(line: string): string[] {
  const indent = ' '.repeat(line.length - line.trimStart().length);
  if (indent === '') return wrap(line, HELP_WIDTH);
  return wrap(line, HELP_WIDTH - indent.length - 2).map((part, index) => `${indent}${index === 0 ? '' : '  '}${part}`);
}

/** Keeps the lines of a free-text block as they are, wrapping only the ones wider than `HELP_WIDTH`. */
function paragraph(text: string): string {
  return text
    .split('\n')
    .flatMap((line) => (line.length <= HELP_WIDTH ? [line] : wrapIndented(line)))
    .join('\n');
}

/**
 * Two-column rows, like `docker --help`: the left column padded to `width`, the right one wrapped
 * so every line fits in `HELP_WIDTH`, with continuation lines aligned under it.
 */
function columns(rows: readonly (readonly [string, string])[], width: number): string[] {
  return rows.map(([left, right]) => column(left, right, width));
}

/** One row of `columns`. */
function column(left: string, right: string, width: number): string {
  const indent = ' '.repeat(width);
  return wrap(right, HELP_WIDTH - width)
    .map((line, index) => (index === 0 ? `${left.padEnd(width)}${line}` : `${indent}${line}`))
    .join('\n')
    .trimEnd();
}

/**
 * A section's rows as one block. When some row wraps, every row is separated by a blank line, so
 * each one reads as a block; a section where every row fits on one line stays compact.
 */
function rowsBlock(rows: readonly string[]): string {
  return rows.join(rows.some((row) => row.includes('\n')) ? '\n\n' : '\n');
}

function columnWidth(labels: readonly string[]): number {
  return Math.max(...labels.map((label) => label.length)) + 3;
}

/**
 * Two-column rows outside a `--help` (a listing, say), laid out and spaced exactly as its sections:
 * the right column wrapped to `HELP_WIDTH`, and a blank line between rows once one of them wraps.
 */
export function formatRows(rows: readonly (readonly [string, string])[]): string {
  return rowsBlock(columns(rows, columnWidth(rows.map(([left]) => left))));
}

/** One section per group, all aligned to the same column (rows spaced as in `rowsBlock`). */
function commandSections(entries: readonly CommandEntry[]): string[] {
  const width = columnWidth(entries.map((entry) => `  ${entry.name}`));
  const groups = new Map<string, CommandEntry[]>();
  for (const entry of entries) {
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry]);
  }
  return [...groups].map(([group, list]) => {
    const rows = columns(
      list.map((entry) => [`  ${entry.name}`, entry.description]),
      width,
    );
    return `${group}:\n${rowsBlock(rows)}`;
  });
}

/**
 * The values of a flag, as a two-column list indented to start under the flag's description (at
 * `indent`), so a value is never taken for a flag. Spaced like any other section (`rowsBlock`).
 */
function choicesBlock(choices: readonly FlagChoice[], indent: number): string {
  const pad = ' '.repeat(indent);
  const width = columnWidth(choices.map((choice) => choice.name));
  return rowsBlock(
    columns(
      choices.map((choice) => [`${pad}${choice.name}`, choice.description]),
      indent + width,
    ),
  );
}

function flagLabel(flag: FlagSpec): string {
  const aliases = flag.aliases ?? [];
  const prefix = aliases.length === 0 ? '      ' : `  ${aliases.join(', ')}, `;
  const value = flag.value === undefined ? '' : ` ${flag.value.name}`;
  return `${prefix}${flag.name}${value}`;
}

/** `--help` text in the layout of `docker --help`: usage, description, command groups, options, footer. */
export function formatHelp(spec: CommandSpec): string {
  const sections = [`Usage:  ${spec.usage}`];
  if (spec.description !== undefined) {
    sections.push(paragraph(spec.description));
  }
  const entries = (spec.commands?.() ?? []).filter((entry) => entry.listed !== false);
  if (entries.length > 0) {
    sections.push(...commandSections(entries));
  }
  const flags = spec.flags ?? [];
  if (flags.length > 0) {
    const width = columnWidth(flags.map(flagLabel));
    const rows = flags.map((flag) => {
      const row = column(flagLabel(flag), flag.description, width);
      const choices = flag.choices ?? [];
      return choices.length === 0 ? row : `${row}\n\n${choicesBlock(choices, width)}`;
    });
    sections.push(`Options:\n${rowsBlock(rows)}`);
  }
  if (spec.footer !== undefined) {
    sections.push(paragraph(spec.footer));
  }
  return sections.join('\n\n');
}
