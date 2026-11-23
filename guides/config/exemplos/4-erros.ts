/**
 * Exemplo 4 do curso de config: uma config errada não é ignorada. Cada
 * arquivo abaixo falha ao carregar, com a mensagem que o Choliba mostra.
 */
import { randomUUID } from 'node:crypto';

import { clearConfigCache, loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  join,
  removePath,
  writeText,
  cholibaCacheDir,
} from '../../../src/filesystem/index';
import { writeOut } from '../../../src/output/stdio';

const wrong = [
  `export default { databasePath: 'dados/choliba.db' };`,
  `export default { logDir: 'logs' };`,
  `export default { debug: 'sim' };`,
  `export default { database: { name: 'dados/choliba.db' } };`,
  `export default { envs: { API_URL: 'x' } };`,
];

for (const source of wrong) {
  const project = join(
    cholibaCacheDir(environment()),
    'config-exemplo',
    randomUUID(),
  );
  ensureDirectory(project);
  writeText(join(project, 'choliba.config.ts'), `${source}\n`);
  clearConfigCache();
  try {
    await loadConfig({ cwd: project });
    writeOut(`${source}\n  carregou (não deveria)\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOut(`${source}\n  → ${message.replaceAll(project, '<projeto>')}\n`);
  } finally {
    removePath(project);
  }
}
