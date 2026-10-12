// What the footer of a running agent shows, and the lines that stand for it where there is no footer.

import { boldAnsi, formatElapsed, Table, td, textWidth, th, type Theme, type WritableWithColumns } from '@choliba/core';

import type { RunContextWords, RunFooterInfo } from '../interfaces/run-footer.interface';

const NONE = '—';

/** The context of a run in words: provider, sandbox, image and container (`—` for the last two on this machine). */
function contextWords(info: RunFooterInfo): RunContextWords {
  const { place, provider } = info;
  if (place.kind === 'local') return { provider, sandbox: 'local', image: NONE, container: NONE };
  return { provider, sandbox: 'docker', image: place.image, container: place.container };
}

/** The footer's table: the titles, then the run's values and how long it has been going. */
export function footerTable(info: RunFooterInfo, now: number): Table {
  return new Table({
    rules: 'none',
    cols: [{}, {}, { shrink: true, minWidth: 8 }, { shrink: true, minWidth: 8 }, { minWidth: 8 }],
    head: [[th('provider'), th('sandbox'), th('imagem'), th('container'), th('decorrido', { abbr: 'tempo' })]],
    bodies: [
      [[...Object.values(contextWords(info)).map((text: string) => td(text)), td(formatElapsed(now - info.startedAt))]],
    ],
  });
}

/** The context and the time on one line, for a terminal too narrow for the table. */
function oneLine(info: RunFooterInfo, now: number, width: number): string {
  const { provider, sandbox } = contextWords(info);
  const line = `${provider} · ${sandbox} · ${formatElapsed(now - info.startedAt)}`;
  return textWidth(line) <= width ? line : formatElapsed(now - info.startedAt);
}

/**
 * The footer's lines in `width` columns: a rule and the table, its titles bold when the theme colors; one line when
 * the table does not fit.
 */
export function footerLines(info: RunFooterInfo, now: number, width: number, theme: Theme): readonly string[] {
  const table = footerTable(info, now);
  if (!table.fits(width)) return [oneLine(info, now, width)];
  return ['─'.repeat(width), ...table.render(width, theme.enabled ? { strong: boldAnsi } : {})];
}

/** What follows the `[provider]` label: the provider, and, in a container, the sandbox, the image and the container. */
export function providerContext(info: Omit<RunFooterInfo, 'startedAt'>): string {
  const { place } = info;
  return place.kind === 'local' ? '' : ` · docker · ${place.image} · ${place.container}`;
}

/** The line the footer leaves when the session ends: where it ran, how long it took and its exit code. */
export function summaryLine(info: RunFooterInfo, now: number, exitCode: number): string {
  const { provider, sandbox } = contextWords(info);
  return `${provider} · ${sandbox} · decorrido ${formatElapsed(now - info.startedAt)} · código ${String(exitCode)}`;
}

/**
 * Whether a run draws a footer: only on a terminal that can move the cursor. A pipe, a file or `TERM=dumb` get the
 * output as it always was. `NO_COLOR` only takes the color away.
 */
export function wantsFooter(stdout: WritableWithColumns, env: Readonly<Record<string, string | undefined>>): boolean {
  return stdout.isTTY === true && env['TERM'] !== 'dumb';
}
