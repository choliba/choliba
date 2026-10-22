/** What a step puts in the prompt when it says no `max_size`: enough for a small model's context, with room. */
export const DEFAULT_MAX_SIZE = 100 * 1024;

/** `max_size` as it is written: a number, then `B`, `KB` or `MB` (bytes with none). */
const MAX_SIZE = /^(\d+)\s*(B|KB|MB)?$/i;

/** How many bytes a unit of `max_size` is. */
function unitBytes(unit: string): number {
  if (unit === 'MB') return 1024 * 1024;
  return unit === 'KB' ? 1024 : 1;
}

/** `max_size` in bytes (`40KB` is 40960); the default when empty (absent); `NaN` when it is not a size. */
export function parseMaxSize(text: string): number {
  if (text.trim() === '') return DEFAULT_MAX_SIZE;
  const match = MAX_SIZE.exec(text.trim());
  if (match === null) return Number.NaN;
  return Number(match[1]) * unitBytes((match[2] ?? 'B').toUpperCase());
}

/** `bytes` for a person: `512 B`, `40 KB`, `3,1 MB`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  const [value, unit] = bytes < 1024 * 1024 ? [bytes / 1024, 'KB'] : [bytes / (1024 * 1024), 'MB'];
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
  return `${shown} ${unit}`;
}

/**
 * Stops a step whose section for the prompt (`size` bytes) is larger than `maxSize`, before the agent: a prompt cut
 * short would lose the agent's own text with no warning. It says the size, the limit, how many files were found and
 * what to do.
 */
export function checkSectionSize(tag: string, size: number, maxSize: number, found: number): void {
  if (size <= maxSize) return;
  throw new Error(
    `a seção <${tag}> tem ${formatSize(size)} e o limite (max_size) é ${formatSize(maxSize)}: ${String(found)} ` +
      `arquivo(s) encontrado(s).\nEstreite o pattern, acrescente pastas ao ignore ou aumente o max_size.`,
  );
}
