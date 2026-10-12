// What the footer of a running agent shows, and the lines that stand for it where there is no footer.

import {
  boldAnsi,
  dimAnsi,
  formatElapsed,
  frameBottom,
  Table,
  td,
  textWidth,
  th,
  type Theme,
  type WritableWithColumns,
} from '@choliba/core';

import type { FooterColumn, RunContextWords, RunFooterInfo } from '../interfaces/run-footer.interface';

const NONE = '—';

/** The context of a run in words: provider, model, sandbox, image and container (`—` for what it does not have). */
function contextWords(info: RunFooterInfo): RunContextWords {
  const { place, provider } = info;
  const model = info.model ?? NONE;
  if (place.kind === 'local') return { provider, model, sandbox: 'local', image: NONE, container: NONE };
  return { provider, model, sandbox: 'docker', image: place.image, container: place.container };
}

/**
 * The footer's columns: provider, model, sandbox and the time, with the image and the container between them only in
 * a container (on this machine they would only say `—`).
 */
function footerColumns(info: RunFooterInfo, now: number): readonly FooterColumn[] {
  const { provider, model, sandbox, image, container } = contextWords(info);
  const inContainer: readonly FooterColumn[] =
    info.place.kind === 'docker'
      ? [
          { title: 'imagem', col: { shrink: true, minWidth: 8 }, value: image },
          { title: 'container', col: { shrink: true, minWidth: 8 }, value: container },
        ]
      : [];
  return [
    { title: 'provider', col: {}, value: provider },
    { title: 'modelo', col: { shrink: true, minWidth: 6 }, value: model },
    { title: 'sandbox', col: {}, value: sandbox },
    ...inContainer,
    { title: 'decorrido', abbr: 'tempo', col: { minWidth: 12 }, value: formatElapsed(now - info.startedAt) },
  ];
}

/** The footer's table: the titles, then the run's values and how long it has been going, with column rules. */
export function footerTable(info: RunFooterInfo, now: number): Table {
  const columns = footerColumns(info, now);
  return new Table({
    rules: 'all',
    cols: columns.map((column) => column.col),
    head: [columns.map((column) => th(column.title, column.abbr === undefined ? {} : { abbr: column.abbr }))],
    bodies: [[columns.map((column) => td(column.value))]],
  });
}

/** The context and the time on one line, for a terminal too narrow for the table. */
function oneLine(info: RunFooterInfo, now: number, width: number): string {
  const { provider, model, sandbox } = contextWords(info);
  const line = `${provider} · ${model} · ${sandbox} · ${formatElapsed(now - info.startedAt)}`;
  return textWidth(line) <= width ? line : formatElapsed(now - info.startedAt);
}

/**
 * The footer's lines in `width` columns: the bottom of the frame the session's lines go in, the `panel` (the
 * reasoning, when there is some, dim when the theme colors), then the table, its titles bold when the theme colors;
 * one line under the frame, without the panel, when the table does not fit.
 */
export function footerLines(
  info: RunFooterInfo,
  now: number,
  width: number,
  theme: Theme,
  panel: readonly string[] = [],
): readonly string[] {
  const table = footerTable(info, now);
  if (!table.fits(width)) return [frameBottom(width), oneLine(info, now, width)];
  const shownPanel = theme.enabled ? panel.map(dimAnsi) : panel;
  return [frameBottom(width), ...shownPanel, ...table.render(width, theme.enabled ? { strong: boldAnsi } : {})];
}

/** What follows the `[provider]` label: the provider, and, in a container, the sandbox, the image and the container. */
export function providerContext(info: Omit<RunFooterInfo, 'startedAt'>): string {
  const { place } = info;
  return place.kind === 'local' ? '' : ` · docker · ${place.image} · ${place.container}`;
}

/** The line the footer leaves when the session ends: where it ran, with which model, how long and its exit code. */
export function summaryLine(info: RunFooterInfo, now: number, exitCode: number): string {
  const { provider, model, sandbox } = contextWords(info);
  const elapsed = formatElapsed(now - info.startedAt);
  return `${provider} · ${model} · ${sandbox} · decorrido ${elapsed} · código ${String(exitCode)}`;
}

/**
 * Whether a run draws a footer: only on a terminal that can move the cursor. A pipe, a file or `TERM=dumb` get the
 * output as it always was. `NO_COLOR` only takes the color away.
 */
export function wantsFooter(stdout: WritableWithColumns, env: Readonly<Record<string, string | undefined>>): boolean {
  return stdout.isTTY === true && env['TERM'] !== 'dumb';
}
