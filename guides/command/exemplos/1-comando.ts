/**
 * Exemplo 1 do curso de command: um comando com um argumento e duas opções,
 * declarado uma vez com `defineCommand` e rodado com `runCommand`. A linha de
 * comando vem fixa no `argv`, para o exemplo rodar como está; num programa de
 * verdade, ela é a do processo.
 *
 *   bun guides/command/exemplos/1-comando.ts
 */
import { defineCommand, runCommand } from '../../../src/command/index';

const saudar = defineCommand({
  name: 'saudar',
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
  run: ({ args, options, output }) => {
    // args.nome é string (obrigatório); options.alto é boolean; options.vezes
    // é string (tem padrão).
    const ola = `Olá, ${args.nome}!`;
    const linha = options.alto ? ola.toUpperCase() : ola;
    output.write(
      Array.from({ length: Number(options.vezes) }, () => linha).join('\n'),
    );
  },
});

await runCommand(saudar, { argv: ['Ana', '--alto', '--vezes', '2'] });
