/**
 * `bun run lint:owners`: writes the owner rules of `.oxlintrc.json` from the
 * table in `scripts/lint-rules.ts`, formatted as Prettier formats the file.
 */

import { format, resolveConfig } from 'prettier';

import { defineCommand, runCommand } from '../src/command/index';
import { currentDirectory } from '../src/execute/process';
import { join, readText, writeText } from '../src/filesystem/index';
import { readLintConfig, withOwnerRules } from './lint-rules';

await runCommand(
  defineCommand({
    name: 'lint:owners',
    description:
      'Reescreve as regras dos donos no .oxlintrc.json a partir da tabela de scripts/lint-rules.ts. Rode depois de mudar a tabela: um teste confere que o arquivo está em dia.',
    options: {
      'dry-run': {
        type: 'boolean',
        description: 'Só diz se o arquivo mudaria, sem gravar',
      },
    },
    run: async ({ options, output }) => {
      const file = join(currentDirectory(), '.oxlintrc.json');
      const before = readText(file);
      const config = withOwnerRules(readLintConfig(before, file));
      const after = await format(JSON.stringify(config, null, 2), {
        ...(await resolveConfig(file)),
        filepath: file,
      });

      if (after === before) {
        output.write('As regras dos donos no .oxlintrc.json já estão em dia.');
        return;
      }
      if (options['dry-run']) {
        output.write(
          'As regras dos donos no .oxlintrc.json mudariam. Rode bun run lint:owners para gravar.',
        );
        return;
      }
      writeText(file, after);
      output.write(
        'Regras dos donos reescritas no .oxlintrc.json. Confira com bun run lint.',
      );
    },
  }),
);
