import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { home } from '../docs/.vitepress/home';
import { frontmatterPage } from './libs/docs-home';

// The site's home, docs/index.md, written from docs/.vitepress/home.ts before the site is served or built. It is
// ignored by git, so docs/ on GitHub keeps only documentation.
writeFileSync(path.join(import.meta.dirname, '..', 'docs', 'index.md'), frontmatterPage(home));
