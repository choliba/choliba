/**
 * Exemplo 2 do curso de command: a ajuda que o `--help` mostra, gerada da
 * declaração do comando (`helpText`). Com `--help`, o `runCommand` responde
 * na hora, sem carregar a config nem rodar o `run`. O `program` diz o nome
 * que aparece na linha de uso.
 *
 *   bun guides/command/exemplos/2-ajuda.ts
 */
import { defineCommand, runCommand } from '../../../src/command/index';

const saudar = defineCommand({
  name: 'saudar',
  program: 'exemplo',
  description: 'Diz olá para alguém.',
  args: {
    nome: { description: 'Quem recebe o olá', required: true },
  },
  options: {
    alto: { type: 'boolean', short: 'a', description: 'Em letras maiúsculas' },
    vezes: {
      type: 'string',
      value: 'n',
      default: '1',
      description: 'Quantas vezes dizer',
    },
  },
  run: ({ output }) => {
    output.write('com --help, isto não roda');
  },
});

await runCommand(saudar, { argv: ['--help'] });
