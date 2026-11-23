/**
 * Exemplo 2 do curso de config: sem choliba.config.ts, os padrões. Num
 * diretório sem arquivo de config (nem nos pais), `loadConfig` não falha.
 */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const empty = join(
  cholibaCacheDir(environment()),
  'config-exemplo',
  randomUUID(),
);
ensureDirectory(empty);

try {
  const config = await loadConfig({ cwd: empty });
  writeOut(
    `${JSON.stringify(config, null, 2).replaceAll(empty, '<diretório>')}\n`,
  );
} finally {
  removePath(empty);
}
