import { complete, formatHelp, type CommandSpec, type Suggestions } from '../../../../scripts/entries/core';

const SERVIR: CommandSpec = {
  usage: 'app servir [OPTIONS]',
  description: 'Sobe o servidor de desenvolvimento.',
  flags: [
    { name: '--porta', description: 'Porta em que ele escuta', value: { name: 'número' } },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  ],
};

/** O `--help` do comando, como o terminal o mostra. */
export function ajudaDeServir(): string {
  return formatHelp(SERVIR);
}

/** O que o autocomplete oferece para a última palavra digitada. */
export function sugestoes(palavras: readonly string[]): Suggestions {
  return complete(SERVIR, palavras);
}
