/**
 * `bun run plan:gate plans/<plano>.md`: the gate before running a plan. Ends
 * with an error unless the plan has the format of .agents/skills/plans and
 * the user marked `[x] Aprovado`. With `--formato`, only the format: for a
 * plan just written, not approved yet. With `--revisado`, also the review
 * the user marks once the phases ran: the gate before deleting the plan.
 */

import { defineCommand, runCommand } from '../src/command/index';
import { UsageError } from '../src/errors';
import { currentDirectory } from '../src/execute/process';
import { pathExists, readText } from '../src/filesystem/index';
import { checkPlan, planPath } from './plan';

await runCommand(
  defineCommand({
    name: 'plan:gate',
    description:
      'Confere um plano de plans/: o formato da skill plans e a aprovação ([x] Aprovado); com --revisado, também a revisão ([x] Revisado). Sai com erro se faltar algum deles.',
    args: {
      plano: {
        description: 'O arquivo do plano: plans/<nome>.md',
        required: true,
      },
    },
    options: {
      formato: {
        type: 'boolean',
        short: 'f',
        description:
          'Confere só o formato (um plano recém-criado, ainda sem aprovação)',
      },
      revisado: {
        type: 'boolean',
        short: 'r',
        description:
          'Confere também a revisão do usuário ([x] Revisado): antes de dar o plano por concluído e apagá-lo',
      },
    },
    run: ({ args, options, output }) => {
      const path = planPath(args.plano, currentDirectory());
      if (!pathExists(path)) {
        throw new UsageError(`O plano ${args.plano} não existe.`);
      }

      const { problems, approved, reviewed } = checkPlan(readText(path));
      if (problems.length > 0) {
        throw new UsageError(
          [
            `O plano ${args.plano} não está no formato da skill plans:`,
            ...problems.map((problem) => `  - ${problem}`),
          ].join('\n'),
        );
      }

      if (options.formato) {
        output.write(
          `${args.plano}: formato certo (${approved ? 'aprovado' : 'ainda não aprovado'}, ${reviewed ? 'revisado' : 'ainda não revisado'}).`,
        );
        return;
      }
      if (!approved) {
        throw new UsageError(
          `O plano ${args.plano} não está aprovado: nada dele roda até o usuário marcar "- [x] Aprovado" na seção Aprovação (a última do arquivo).`,
        );
      }
      if (options.revisado) {
        if (!reviewed) {
          throw new UsageError(
            `O plano ${args.plano} ainda não foi revisado: ele só está concluído quando o usuário marcar "- [x] Revisado" abaixo da última fase.`,
          );
        }
        output.write(
          `${args.plano}: aprovado e revisado. Concluído: pode apagar o plano.`,
        );
        return;
      }
      output.write(`${args.plano}: aprovado. Pode executar.`);
    },
  }),
);
