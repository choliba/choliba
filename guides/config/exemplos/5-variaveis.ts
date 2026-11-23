/**
 * Exemplo 5 do curso de config: CHOLIBA_DEBUG e CHOLIBA_LOG_DIR valem mais que
 * o arquivo, sem editá-lo. Rode de três jeitos:
 *
 *   bun guides/config/exemplos/5-variaveis.ts
 *   CHOLIBA_DEBUG=0 bun guides/config/exemplos/5-variaveis.ts
 *   CHOLIBA_LOG_DIR=/tmp/meus-logs bun guides/config/exemplos/5-variaveis.ts
 */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  writeText,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const project = join(
  cholibaCacheDir(environment()),
  'config-exemplo',
  randomUUID(),
);
ensureDirectory(project);
writeText(
  join(project, 'choliba.config.ts'),
  `export default { debug: true, logger: { dir: 'logs' } };\n`,
);

try {
  const { debug, logger } = await loadConfig({ cwd: project });
  writeOut(
    `debug: ${String(debug)}, logger.dir: ${logger.dir.replaceAll(project, '<projeto>')}\n`,
  );
} finally {
  removePath(project);
}
