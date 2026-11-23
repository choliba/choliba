/**
 * `bun run docs:pages`: writes the pages of the site that come from the
 * repository, before `docs:build` and `docs:dev` (see the `documentation`
 * skill). They are generated: not edited by hand, not versioned.
 */

import { defineCommand, runCommand } from '../src/command/index';
import { COMMANDS } from '../src/cli/commands';
import { currentDirectory } from '../src/execute/process';
import {
  ensureDirectory,
  join,
  listDirectory,
  pathExists,
  readText,
  writeText,
} from '../src/filesystem/index';
import {
  commandsPage,
  guidePage,
  guidesIndexPage,
  guidesSidebar,
  type Guide,
} from './docs';

/** The courses, in alphabetical order of their folders: the ones that have a README. */
function readGuides(root: string): readonly Guide[] {
  const folder = join(root, 'guides');
  return listDirectory(folder)
    .toSorted()
    .filter((module) => pathExists(join(folder, module, 'README.md')))
    .map((module) => ({
      module,
      markdown: readText(join(folder, module, 'README.md')),
    }));
}

await runCommand(
  defineCommand({
    name: 'docs:pages',
    description:
      'Escreve as páginas do site que saem do repositório: os cursos de guides/ em docs/guias/, a lista de comandos em docs/comandos.md e o menu dos cursos.',
    run: ({ output }) => {
      const root = currentDirectory();
      const guides = readGuides(root);
      const pages = join(root, 'docs', 'guias');
      ensureDirectory(pages);
      for (const guide of guides) {
        writeText(join(pages, `${guide.module}.md`), guidePage(guide));
      }
      writeText(join(pages, 'index.md'), guidesIndexPage(guides));
      writeText(join(root, 'docs', 'comandos.md'), commandsPage(COMMANDS));
      const generated = join(root, 'docs', '.vitepress', 'generated');
      ensureDirectory(generated);
      writeText(
        join(generated, 'guides-sidebar.json'),
        `${JSON.stringify(guidesSidebar(guides), undefined, 2)}\n`,
      );
      output.write(
        `${String(guides.length)} cursos e a lista de comandos escritos em docs/.`,
      );
    },
  }),
);
