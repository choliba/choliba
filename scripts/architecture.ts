/**
 * Writes the checked-in lists of the package graph and of what each entry exports (`scripts/architecture/`), which
 * `scripts/__tests__/architecture.spec.ts` compares with the code. Run it after a change to either, on purpose.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXPORTS_FILE, entryExports, exportsText, GRAPH_FILE, graphText, packageGraph } from './libs/architecture';

const root = join(import.meta.dirname, '..');
writeFileSync(join(root, GRAPH_FILE), graphText(packageGraph(root)));
writeFileSync(join(root, EXPORTS_FILE), exportsText(entryExports(root)));
process.stdout.write(`${GRAPH_FILE} e ${EXPORTS_FILE} atualizados.\n`);
