import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const WRITE_FILES_USAGE = 'write_files <arquivo...>';

/** A code block around the whole answer (```markdown … ```), which a model often adds: its first and last lines. */
const WRAPPING_FENCE = /^```[^\n]*\n([\s\S]*)\n```$/;

/** The answer as it goes to the file: without a code block that wraps all of it, ending with one line break. */
export function answerContent(answer: string): string {
  const trimmed = answer.trim();
  const inside = WRAPPING_FENCE.exec(trimmed)?.[1] ?? trimmed;
  return `${inside.trim()}\n`;
}

/**
 * The `write_files` action: the agent's final answer saved to each file (relative to the workspace root, or absolute),
 * its folders made and what was there replaced. With no answer (the provider gave no text), it fails saying so.
 */
export function writeFiles(repoRoot: string, answer: string | undefined, files: readonly string[]): void {
  if (answer === undefined || answer.trim() === '') {
    throw new Error('o agente não deu resposta para gravar');
  }
  const content = answerContent(answer);
  for (const file of files) {
    const path = resolve(repoRoot, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}
