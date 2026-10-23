import type { CommandSpec } from '@choliba/shell';
import { EXPECTATIONS } from '@choliba/runner';

/**
 * `choliba run tests`, as `--help` shows it and completion walks: this CLI's own arguments (the projects
 * come from `projectNames`, and after `project:` its tickets from `ticketsOf`); any other flag goes on
 * to `playwright test`.
 */
export function testsCliSpec(
  projectNames: () => readonly string[],
  ticketsOf: (project: string) => readonly string[],
): CommandSpec {
  const targets = (current: string): readonly string[] => {
    const colon = current.indexOf(':');
    if (colon === -1) return projectNames();
    const project = current.slice(0, colon);
    return ticketsOf(project).map((ticket) => `${project}:${ticket}`);
  };
  return {
    usage: 'choliba run tests [PROJECT[:TICKET][/PATH]] [OPTIONS] [PLAYWRIGHT OPTIONS]',
    description:
      'Roda os testes E2E dos projetos com o Playwright. Sem projeto, roda todos; com projeto:ticket, só os daquele ticket.',
    examples: [
      { description: 'Roda os testes de todos os projetos', command: 'choliba run tests' },
      { description: 'Roda os testes de todos os tickets do projeto loja', command: 'choliba run tests loja' },
      { description: 'Roda os testes do ticket loja-1', command: 'choliba run tests loja:1' },
      { description: 'Roda uma lista de tickets (também glob e intervalo)', command: 'choliba run tests loja:1,2' },
      { description: 'Roda um arquivo do projeto', command: 'choliba run tests loja/tests/a.spec.ts' },
      {
        description: 'Confere que os testes do ticket falham pelo comportamento, gravando as falhas',
        command: 'choliba run tests loja:1 --expect red --failures falhas.md',
      },
    ],
    details: [
      'Antes de rodar, o choliba deixa a aplicação do projeto pronta: veja',
      '[A aplicação do projeto](../referencia/aplicacao-do-projeto.md). `--expect` e `--failures` são os portões que os',
      'agentes usam no TDD; os testes de critérios que outro ticket substituiu saem das rodadas do projeto. Os dois estão',
      'em [Critérios de aceite e portões](../referencia/criterios-e-portoes.md). Qualquer outra opção vai para o',
      '`playwright test` (veja `bunx playwright test --help`).',
    ].join('\n'),
    flags: [
      {
        name: '--expect',
        description: 'O que a execução de um ticket deve mostrar; falha se não mostrar',
        value: { name: 'red|green', suggest: () => ({ kind: 'values', values: EXPECTATIONS }) },
      },
      {
        name: '--failures',
        description: 'Grava em FILE como os testes do ticket falharam',
        value: { name: 'file', suggest: () => ({ kind: 'files' }) },
      },
      { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
    ],
    positionals: (previous, current) => ({ kind: 'values', values: previous.length === 0 ? targets(current) : [] }),
    footer: "Outras opções vão para o 'playwright test'; veja 'bunx playwright test --help'.",
  };
}
