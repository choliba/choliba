/** `bun run git:clean`: deletes the local branches already merged into develop, keeping master and develop. */

import { defineCommand, runCommand } from '../src/command/index';
import { currentDirectory } from '../src/execute/process';
import { cleanBranches } from './branches';

await runCommand(
  defineCommand({
    name: 'git:clean',
    description:
      'Apaga as branches locais já mergeadas na develop (merge normal ou squash), mantendo a master e a develop. Rode `git pull` na develop antes, senão as recém-mergeadas ficam de fora.',
    run: async ({ output }) => {
      const { deleted, skipped, switchedTo } =
        await cleanBranches(currentDirectory());
      if (switchedTo !== undefined) output.write(`Trocado para ${switchedTo}.`);
      for (const name of deleted) output.write(`Apagada: ${name}`);
      for (const name of skipped)
        output.write(`Mantida (não mergeada na develop): ${name}`);
      output.write(
        deleted.length === 0
          ? 'Nada para limpar.'
          : `${String(deleted.length)} branch(es) apagada(s).`,
      );
    },
  }),
);
