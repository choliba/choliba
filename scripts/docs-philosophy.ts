import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { description } from '../docs/.vitepress/philosophy';
import { rootPage } from './libs/docs-root-page';

const ROOT = path.join(import.meta.dirname, '..');

// The site's /filosofia, docs/filosofia.md, written from PHILOSOPHY.md before the site is served or built. It is
// ignored by git, so PHILOSOPHY.md stays the only copy.
writeFileSync(
  path.join(ROOT, 'docs', 'filosofia.md'),
  rootPage(readFileSync(path.join(ROOT, 'PHILOSOPHY.md'), 'utf8'), description),
);
