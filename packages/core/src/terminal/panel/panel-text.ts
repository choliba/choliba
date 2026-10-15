import { ansiChunks } from '../frame';

/** `text` in lines of at most `width` characters, broken between words; a word longer than `width` stays whole. */
export function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line === '' ? word : `${line} ${word}`;
    if (next.length > width && line !== '') {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  return lines;
}

/** How many rows `line` takes in `width` columns, broken between words: its escape codes take none. */
export function wrappedRows(line: string, width: number): number {
  const text = ansiChunks(line)
    .map((chunk) => chunk.text)
    .join('');
  return wrapWords(text, width).length;
}
