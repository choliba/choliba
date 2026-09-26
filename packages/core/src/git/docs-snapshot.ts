import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface DocFile {
  /** Caminho relativo a `docs/` (ex.: `01-arquitetura.md`). */
  readonly path: string;
  readonly content: string;
}

export interface DocsSnapshot {
  readonly readme: string | null;
  readonly docs: readonly DocFile[];
}

function collectMarkdownFiles(dir: string, base: string): DocFile[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  const files: DocFile[] = [];

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolute, base));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    files.push({
      path: relative(base, absolute),
      content: readFileSync(absolute, 'utf8'),
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Lê `README.md` na raiz e todos os `.md` em `docs/`. Diretórios ausentes retornam vazio/null. */
export function collectDocsSnapshot(root: string): DocsSnapshot {
  const readmePath = join(root, 'README.md');
  const docsDir = join(root, 'docs');

  return {
    readme: existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : null,
    docs: collectMarkdownFiles(docsDir, docsDir),
  };
}
