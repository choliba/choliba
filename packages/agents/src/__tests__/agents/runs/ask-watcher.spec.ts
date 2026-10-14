import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AskAnswer, AskQuestion } from '../../../common/run-tools/ask-tool';
import { watchQuestions } from '../../../agents/runs/ask-watcher';
import { makeTmpDir } from '../../helpers/tmp';

/** A timer the spec ticks by hand. */
function manualTimer(): { every: (ms: number, tick: () => void) => () => void; tick: () => void; stopped: boolean[] } {
  const ticks: (() => void)[] = [];
  const stopped: boolean[] = [];
  return {
    every: (_ms, tick) => {
      ticks.push(tick);
      return () => stopped.push(true);
    },
    tick: () => {
      ticks.forEach((tick) => {
        tick();
      });
    },
    stopped,
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('watchQuestions', () => {
  it('hands each question once to the answer, writes the reply next to it, and ignores what is not one', async () => {
    const tmp = makeTmpDir('ask-watcher');
    try {
      const dir = join(tmp.path, '.choliba-ask');
      const asked: AskQuestion[] = [];
      const timer = manualTimer();
      const stop = watchQuestions(
        dir,
        (question): Promise<AskAnswer> => {
          asked.push(question);
          return Promise.resolve({ status: 'answered', answer: 'Ana' });
        },
        timer.every,
      );
      timer.tick();
      mkdirSync(dir);
      writeFileSync(
        join(dir, '1.question.json'),
        JSON.stringify({ id: '1', question: 'Nome?', options: [], multi: false }),
      );
      writeFileSync(join(dir, '2.question.json'), '{ not json');
      writeFileSync(
        join(dir, '3.question.json'),
        JSON.stringify({ id: '3', question: 'x', options: [1], multi: false }),
      );
      writeFileSync(join(dir, '4.question.json'), JSON.stringify({ id: 4 }));
      writeFileSync(join(dir, '5.question.json'), 'null');
      writeFileSync(join(dir, 'outro.txt'), 'x');
      timer.tick();
      timer.tick();
      await flush();

      expect(asked).toEqual([{ id: '1', question: 'Nome?', options: [], multi: false }]);
      expect(JSON.parse(readFileSync(join(dir, '1.answer.json'), 'utf8'))).toEqual({
        status: 'answered',
        answer: 'Ana',
      });
      stop();
      expect(timer.stopped).toEqual([true]);
    } finally {
      tmp.cleanup();
    }
  });
});
