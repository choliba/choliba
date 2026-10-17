import { extname } from 'node:path';

import { untrustedBlock, type AgentStep } from '../../common';
import { listField, textField, type FieldSpec } from './step-fields';
import { searchFolder, type FolderTree } from './step-search';
import { saveListing } from './step-listing';
import { checkSectionSize, parseMaxSize } from './step-size';

export const SEARCH_FILES_USAGE = 'search_files: { tag, dirs, pattern?, ignore?, max_depth?, files?, max_size? }';

export const SEARCH_FILES_FIELDS: FieldSpec = {
  required: ['tag', 'dirs'],
  optional: ['pattern', 'ignore', 'max_depth', 'files', 'max_size'],
  lists: ['dirs', 'pattern', 'ignore', 'files'],
};

/** How deep the folders of the summary go, and how many of them and of the extensions it shows. */
const FOLDER_DEPTH = 2;
const MAX_FOLDERS = 200;
const MAX_EXTENSIONS = 30;

/** The folders up to `FOLDER_DEPTH` levels, `MAX_FOLDERS` at most, saying how many more there are. */
function folderLines(folders: readonly string[]): readonly string[] {
  const shallow = folders.filter((folder) => folder.split('/').length <= FOLDER_DEPTH);
  const shown = shallow.slice(0, MAX_FOLDERS).map((folder) => `${folder}/`);
  const hidden = shallow.length - shown.length;
  return hidden > 0 ? [...shown, `(e mais ${String(hidden)} pastas)`] : shown;
}

/** How many files there are of each extension, the most common first, `MAX_EXTENSIONS` at most. */
function extensionLines(files: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    const extension = extname(file);
    if (extension !== '') counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  return [...counts]
    .toSorted(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .slice(0, MAX_EXTENSIONS)
    .map(([extension, count]) => `${String(count).padStart(7)} ${extension}`);
}

/** The summary of one folder: its folders up to two levels, then its files by extension, saying when `max_depth` cut. */
export function folderSummary(tree: FolderTree): string {
  const cut =
    tree.cutAt === undefined
      ? []
      : [`(busca limitada a ${String(tree.cutAt)} níveis: há pastas mais fundas não lidas)`];
  return [
    `# pastas (até ${String(FOLDER_DEPTH)} níveis)`,
    ...folderLines(tree.folders),
    '',
    `# arquivos por extensão (${String(tree.files.length)} arquivos)`,
    ...extensionLines(tree.files),
    ...cut,
  ].join('\n');
}

/**
 * The `search_files` action: a summary of what each of `dirs` holds (its folders up to two levels and how many files
 * there are of each extension, those `pattern` matches when given), in the prompt between `<tag>` and `</tag>`, as
 * untrusted data. `max_depth` stops the search that many levels down. With `files`, the whole list of what it found is saved there too, for a `read_files` with `source`
 * or for a person to check. A section larger than `max_size` stops the step, once the list is saved.
 */
export function searchFiles(repoRoot: string, step: AgentStep): string {
  const tag = textField(step, 'tag');
  const maxDepth = textField(step, 'max_depth');
  const search = {
    pattern: listField(step, 'pattern'),
    ignore: listField(step, 'ignore'),
    ...(maxDepth === '' ? {} : { maxDepth: Number(maxDepth) }),
  };
  const trees = listField(step, 'dirs').map((dir) => ({ dir, tree: searchFolder(repoRoot, dir, search) }));
  // The whole list goes to `files` first: it stays on disk even when the size check or the run stops after.
  saveListing(
    repoRoot,
    listField(step, 'files'),
    trees.map(({ dir, tree }) => ({ dir, files: tree.files })),
  );
  const parts = trees.map(({ dir, tree }) => untrustedBlock(`search:${dir}`, folderSummary(tree)));
  const section = [`<${tag}>`, ...parts, `</${tag}>`].join('\n\n');
  const found = trees.reduce((total, { tree }) => total + tree.files.length, 0);
  checkSectionSize(tag, Buffer.byteLength(section, 'utf8'), parseMaxSize(textField(step, 'max_size')), found);
  return section;
}
