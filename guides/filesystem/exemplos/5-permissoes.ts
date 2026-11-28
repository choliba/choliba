/**
 * Exemplo 5 do curso de filesystem: o `mode` de pastas e arquivos. Vale só
 * quando o arquivo ou a pasta é criado. O Choliba usa PRIVATE_DIR_MODE
 * (0o700) e PRIVATE_FILE_MODE (0o600), do constants.ts, para o que só o dono
 * deve ler (o log, o cache). Para mostrar o mode, o exemplo pergunta ao
 * `stat` (um programa auxiliar, pelo execute).
 */
import { randomUUID } from 'node:crypto';

import { environment, runProgram } from '../../../src/execute/process';
import {
  PRIVATE_DIR_MODE,
  PRIVATE_FILE_MODE,
} from '../../../src/filesystem/constants';
import {
  appendText,
  ensureDirectory,
  cholibaCacheDir,
  join,
  removePath,
  writeText,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const dir = join(cholibaCacheDir(environment()), 'fs-exemplo', randomUUID());

const mode = async (path: string): Promise<string> =>
  (await runProgram('stat', ['-c', '%a', path], { timeoutMs: 5000 })).trim();

try {
  ensureDirectory(join(dir, 'privada'), PRIVATE_DIR_MODE);
  writeText(join(dir, 'privada', 'log.jsonl'), '{}\n', PRIVATE_FILE_MODE);
  writeText(join(dir, 'publico.txt'), 'oi\n');
  // Já existe: o mode passado agora não muda nada.
  appendText(join(dir, 'publico.txt'), 'de novo\n', PRIVATE_FILE_MODE);

  writeOut(`privada/          ${await mode(join(dir, 'privada'))}\n`);
  writeOut(
    `privada/log.jsonl ${await mode(join(dir, 'privada', 'log.jsonl'))}\n`,
  );
  writeOut(`publico.txt       ${await mode(join(dir, 'publico.txt'))}\n`);
} finally {
  removePath(dir);
}
