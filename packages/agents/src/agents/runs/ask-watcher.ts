import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AskAnswer, AskQuestion } from '../../common';

const QUESTION = '.question.json';

/** The question in `file`, or `undefined` when it is not one the `ask` script wrote. */
function readQuestion(file: string): AskQuestion | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { id, question, options, multi } = parsed as Record<string, unknown>;
    if (typeof id !== 'string' || typeof question !== 'string' || typeof multi !== 'boolean') return undefined;
    if (!Array.isArray(options) || !options.every((option) => typeof option === 'string')) return undefined;
    return { id, question, options, multi };
  } catch {
    return undefined;
  }
}

/**
 * Watches `dir` (`askExchangeDir`) every `ms` for the questions the `ask` script writes, hands each one, once, to
 * `answer`, and writes what it gives next to it, which the script is waiting for; an answer that comes once the run's
 * folder is gone is dropped. Returns what stops watching.
 */
export function watchQuestions(
  dir: string,
  answer: (question: AskQuestion) => Promise<AskAnswer>,
  every: (ms: number, tick: () => void) => () => void,
  ms = 250,
): () => void {
  const seen = new Set<string>();
  return every(ms, () => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).filter((file) => file.endsWith(QUESTION) && !seen.has(file))) {
      seen.add(name);
      const question = readQuestion(join(dir, name));
      if (question === undefined) continue;
      void answer(question).then((reply) => {
        try {
          writeFileSync(join(dir, `${question.id}.answer.json`), JSON.stringify(reply));
        } catch {
          // The run ended, its folder gone, before the answer came: no one waits for it.
        }
      });
    }
  });
}
