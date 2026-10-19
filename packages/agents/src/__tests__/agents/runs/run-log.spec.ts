import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loggedStream, NO_RUN_LOG, openRunLog } from '../../../agents/runs/run-log';
import { makeTmpDir } from '../../helpers/tmp';

const NOW = (): Date => new Date('2026-10-18T20:58:01.123Z');

describe('openRunLog', () => {
  it('writes the header, then each line at once, after its time and source, without colors', () => {
    const tmp = makeTmpDir('run-log');
    try {
      const log = openRunLog(tmp.path, 'echo', ['choliba run agent echo 1.0.0', 'modo: ask'], NOW);

      expect(log.path.startsWith(join(tmp.path, 'echo', '2026-10-18T20-58-01.123Z-'))).toBe(true);
      expect(readFileSync(log.path, 'utf8')).toBe('choliba run agent echo 1.0.0\nmodo: ask\n\n');
      log.write('erro', '\u001b[31m✗ parou\u001b[39m\n  motivo\n');
      log.write('provider', '{"type":"init"}');

      expect(readFileSync(log.path, 'utf8')).toBe(
        [
          'choliba run agent echo 1.0.0',
          'modo: ask',
          '',
          '2026-10-18T20:58:01.123Z [erro] ✗ parou',
          '2026-10-18T20:58:01.123Z [erro]   motivo',
          '2026-10-18T20:58:01.123Z [provider] {"type":"init"}',
          '',
        ].join('\n'),
      );
      expect(openRunLog(tmp.path, 'echo', [], NOW).path).not.toBe(log.path);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('openRunLog — a log that goes missing', () => {
  it('makes its folder and file again when they are deleted while the run goes', () => {
    const tmp = makeTmpDir('run-log-gone');
    try {
      const log = openRunLog(tmp.path, 'echo', ['cabeçalho'], NOW);
      rmSync(join(tmp.path, 'echo'), { recursive: true, force: true });
      log.write('choliba', 'fim: código 0');

      expect(readFileSync(log.path, 'utf8')).toBe('2026-10-18T20:58:01.123Z [choliba] fim: código 0\n');
    } finally {
      tmp.cleanup();
    }
  });

  it('never throws when it cannot be written at all', () => {
    const tmp = makeTmpDir('run-log-blocked');
    try {
      // A file where its folder would be: neither the folder nor the log can be made.
      writeFileSync(join(tmp.path, 'echo'), 'não é pasta');
      const log = openRunLog(tmp.path, 'echo', ['cabeçalho'], NOW);

      expect(() => {
        log.write('erro', 'linha');
      }).not.toThrow();
    } finally {
      tmp.cleanup();
    }
  });
});

describe('loggedStream', () => {
  it('writes each chunk to the stream and to the log, keeping what else the stream has', () => {
    const written: string[] = [];
    const logged: string[] = [];
    const stream = { columns: 120, isTTY: true, write: (chunk: string) => void written.push(chunk) };
    const log = { path: 'x', write: (source: string, text: string) => void logged.push(`${source}:${text}`) };

    const tee = loggedStream(stream, log, 'saida');
    tee.write('olá\n');

    expect(written).toEqual(['olá\n']);
    expect(logged).toEqual(['saida:olá\n']);
    expect([tee.columns, tee.isTTY]).toEqual([120, true]);
  });

  it('keeps nothing for a run without a log', () => {
    expect(NO_RUN_LOG.path).toBe('');
    expect(() => {
      NO_RUN_LOG.write('choliba', 'nada');
    }).not.toThrow();
  });
});
