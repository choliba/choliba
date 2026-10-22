export interface DiffFileEntry {
  /** A novo, D removido, R renomeado, M modificado. */
  readonly status: 'A' | 'D' | 'R' | 'M';
  readonly path: string;
  /** Linha (1-based) do diff em que o arquivo começa. */
  readonly line: number;
  /** Quantas linhas o bloco ocupa no patch. */
  readonly lines: number;
}

export function parseDiffBlock(block: readonly string[], start: number, end: number): DiffFileEntry {
  const headerLine = block[0];
  const header = headerLine === undefined ? null : /^diff --git a\/(.*) b\/(.*)$/.exec(headerLine);
  const oldPath = header?.[1] ?? '';
  const newPath = header?.[2] ?? oldPath;
  let status: DiffFileEntry['status'] = 'M';
  if (block.some((line) => line.startsWith('new file mode'))) {
    status = 'A';
  } else if (block.some((line) => line.startsWith('deleted file mode'))) {
    status = 'D';
  } else if (block.some((line) => line.startsWith('rename from '))) {
    status = 'R';
  }
  return {
    status,
    path: status === 'R' ? `${oldPath} -> ${newPath}` : newPath,
    line: start + 1,
    lines: end - start,
  };
}

/** Índice do patch: linha de início de cada arquivo, para leitura parcial com offset/limit. */
export function indexDiff(diff: string): DiffFileEntry[] {
  const lines = diff.split('\n');
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (line.startsWith('diff --git ')) {
      starts.push(index);
    }
  });

  return starts.map((start, i) => {
    const end = starts[i + 1] ?? lines.length;
    return parseDiffBlock(lines.slice(start, end), start, end);
  });
}
