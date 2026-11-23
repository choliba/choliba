/** Exemplo 7 do curso de config: escolher onde os homes dos workspaces ficam. */
import { randomUUID } from 'node:crypto';

import { loadConfig } from '../../../src/config/index';
import { environment } from '../../../src/execute/process';
import {
  ensureDirectory,
  cholibaCacheDir,
  join,
  removePath,
  writeText,
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
  `export default { workspaces: { homes: 'storage/homes' } };\n`,
);

try {
  const config = await loadConfig({ cwd: project });
  writeOut(
    `workspaces.homes: ${config.workspaces.homes.replaceAll(project, '<projeto>')}\n`,
  );
} finally {
  removePath(project);
}
