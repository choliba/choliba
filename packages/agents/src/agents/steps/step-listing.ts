import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** The files found in one folder, as paths relative to it. */
export interface FolderListing {
  readonly dir: string;
  readonly files: readonly string[];
}

/** What starts the files of a folder in a listing: `# <folder>`, then one path relative to it per line. */
const FOLDER_LINE = '# ';

/** The listing as text: each folder as a `# <folder>` line, then its files, one per line. */
export function formatListing(listings: readonly FolderListing[]): string {
  return `${listings.flatMap(({ dir, files }) => [`${FOLDER_LINE}${dir}`, ...files]).join('\n')}\n`;
}

/** The listing a text holds; a path before any `# <folder>` line is relative to the workspace root (`.`). */
export function parseListing(text: string): readonly FolderListing[] {
  const listings: { dir: string; files: string[] }[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith(FOLDER_LINE)) listings.push({ dir: line.slice(FOLDER_LINE.length), files: [] });
    else if (line.trim() !== '') {
      if (listings.length === 0) listings.push({ dir: '.', files: [] });
      listings.at(-1)?.files.push(line);
    }
  }
  return listings;
}

/** Saves the listing to each of `files` (relative to the workspace root, or absolute), making their folders. */
export function saveListing(repoRoot: string, files: readonly string[], listings: readonly FolderListing[]): void {
  const text = formatListing(listings);
  for (const file of files) {
    const path = resolve(repoRoot, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
}

/** The listing saved in `source`; a missing file says which, and that a `search_files` step writes it. */
export function loadListing(repoRoot: string, source: string): readonly FolderListing[] {
  try {
    return parseListing(readFileSync(resolve(repoRoot, source), 'utf8'));
  } catch {
    throw new Error(`a lista ${source} não existe: um search_files com files: ['${source}'] a grava antes`);
  }
}
