import type { CommandSpec } from '@choliba/core';

import { EXPECTATIONS } from './ticket-verdict';

/**
 * `choliba tests`, as `--help` shows it and completion walks: this CLI's own arguments (the projects
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
    usage: 'choliba tests [PROJECT[:TICKET][/PATH]] [OPTIONS] [PLAYWRIGHT OPTIONS]',
    description: [
      'Roda os testes E2E dos projetos com o Playwright. Sem PROJECT, roda todos os projetos.',
      '',
      '  demo                 todos os tickets do projeto demo',
      '  demo:T-01            os testes do ticket T-01',
      '  demo:T-01,T-02       uma lista de tickets (também glob e intervalo)',
      '  demo/tests/a.spec.ts um arquivo do projeto',
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
