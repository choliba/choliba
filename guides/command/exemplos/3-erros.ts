/**
 * Exemplo 3 do curso de command: erros de uso. Uma linha que não bate com a
 * declaração (sem o argumento obrigatório, com uma opção que não existe) é
 * recusada antes de qualquer coisa; um valor que só o `run` sabe conferir
 * vira um `UsageError` lá dentro. Nos três casos, a mensagem aparece e o
 * programa termina com o código 1; aqui, um `onFailure` mostra isso no lugar
 * de encerrar o processo.
 *
 *   bun guides/command/exemplos/3-erros.ts
 */
import { defineCommand, runCommand } from '../../../src/command/index';
import { UsageError } from '../../../src/errors';
import { writeOut } from '../../../src/output/stdio';

const saudar = defineCommand({
  name: 'saudar',
  description: 'Diz olá para alguém.',
  args: {
    nome: { description: 'Quem recebe o olá', required: true },
  },
  options: {
    vezes: {
      type: 'string',
      value: 'n',
      default: '1',
      description: 'Quantas vezes dizer',
    },
  },
  run: ({ args, options, output }) => {
    const vezes = Number(options.vezes);
    if (!Number.isInteger(vezes) || vezes < 1) {
      throw new UsageError(
        `--vezes precisa ser um número inteiro maior que zero, não "${options.vezes}".`,
      );
    }
    output.write(`Olá, ${args.nome}!`);
  },
});

for (const argv of [[], ['Ana', '--cor', 'azul'], ['Ana', '--vezes', 'duas']]) {
  writeOut(`${['$ bun saudar', ...argv].join(' ')}\n`);
  let code = 0;
  await runCommand(saudar, {
    argv,
    onFailure: () => {
      code = 1;
    },
  });
  writeOut(`(código de saída: ${String(code)})\n\n`);
}
