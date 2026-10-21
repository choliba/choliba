import { defaultStdout, type WritableWithColumns } from './writable';

const MAX_WIDTH = 120;

export interface BoxOptions {
  cols?: number;
  stream?: WritableWithColumns;
}

export function printBox(lines: string[], options: BoxOptions = {}): void {
  const stream = options.stream ?? defaultStdout;
  const streamColumns = stream.columns;
  const rawCols =
    options.cols && options.cols > 0 ? options.cols : streamColumns && streamColumns > 0 ? streamColumns : 80;
  const cols = Math.min(rawCols, MAX_WIDTH);
  const border = '-'.repeat(cols);
  const inner = cols - 2;
  const PADDING = 2;

  stream.write(`${border}\n`);
  for (const line of lines) {
    const padRight = Math.max(inner - PADDING - line.length, 0);
    stream.write(`|${' '.repeat(PADDING)}${line}${' '.repeat(padRight)}|\n`);
  }
  stream.write(`${border}\n`);
}
