import { boldAnsi, type AnsiColor, type Theme } from '../theme';
import { formatElapsed } from './status-footer';
import { frameBottom } from './frame';
import { Table, td, textWidth, th, type TableColumn } from './table';
import type { WritableWithColumns } from './writable';

export interface RunPresentationInfo {
  readonly provider: string;
  readonly place:
    { readonly kind: 'local' } | { readonly kind: 'docker'; readonly image: string; readonly container: string };
  readonly startedAt: number;
  readonly model?: string;
}

interface FooterColumn {
  readonly title: string;
  readonly abbr?: string;
  readonly col: TableColumn;
  readonly value: string;
}

const NONE = '—';

function columnsFor(info: RunPresentationInfo, now: number): readonly FooterColumn[] {
  const shared: readonly FooterColumn[] = [
    { title: 'provider', col: {}, value: info.provider },
    { title: 'modelo', col: { shrink: true, minWidth: 6 }, value: info.model ?? NONE },
    { title: 'sandbox', col: {}, value: info.place.kind },
  ];
  const container: readonly FooterColumn[] =
    info.place.kind === 'docker'
      ? [
          { title: 'imagem', col: { shrink: true, minWidth: 8 }, value: info.place.image },
          { title: 'container', col: { shrink: true, minWidth: 8 }, value: info.place.container },
        ]
      : [];
  return [
    ...shared,
    ...container,
    { title: 'decorrido', abbr: 'tempo', col: { minWidth: 12 }, value: formatElapsed(now - info.startedAt) },
  ];
}

export function footerTable(info: RunPresentationInfo, now: number): Table {
  const columns = columnsFor(info, now);
  return new Table({
    rules: 'all',
    cols: columns.map((column) => column.col),
    head: [columns.map((column) => th(column.title, column.abbr === undefined ? {} : { abbr: column.abbr }))],
    bodies: [[columns.map((column) => td(column.value))]],
  });
}

export function oneLine(info: RunPresentationInfo, now: number, width: number): string {
  const sandbox = info.place.kind;
  const line = `${info.provider} · ${info.model ?? NONE} · ${sandbox} · ${formatElapsed(now - info.startedAt)}`;
  return textWidth(line) <= width ? line : formatElapsed(now - info.startedAt);
}

export function footerLines(info: RunPresentationInfo, now: number, width: number, theme: Theme): readonly string[] {
  const table = footerTable(info, now);
  if (!table.fits(width)) return [frameBottom(width), oneLine(info, now, width)];
  return [frameBottom(width), ...table.render(width, theme.enabled ? { strong: boldAnsi } : {})];
}

export function providerContext(info: Pick<RunPresentationInfo, 'place'>): string {
  return info.place.kind === 'local' ? '' : ` · docker · ${info.place.image} · ${info.place.container}`;
}

export function summaryLine(info: RunPresentationInfo, now: number, exitCode: number): string {
  return `${info.provider} · ${info.model ?? NONE} · ${info.place.kind} · decorrido ${formatElapsed(now - info.startedAt)} · código ${String(exitCode)}`;
}

export function wantsFooter(stdout: WritableWithColumns, env: Readonly<Record<string, string | undefined>>): boolean {
  return stdout.isTTY === true && env['TERM'] !== 'dumb';
}

export type { AnsiColor };
