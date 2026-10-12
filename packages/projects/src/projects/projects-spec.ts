import type { CommandSpec, FlagSpec } from '@choliba/core';

const HELP_FLAG: FlagSpec = { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true };

/** `choliba new project`: a project from the template; on a terminal, what is missing is asked. */
export function newProjectSpec(): CommandSpec {
  return {
    usage: 'choliba new project [NOME] [OPTIONS]',
    description:
      'Cria um projeto a partir do modelo; o que faltar é perguntado no terminal.\n\nExemplo:\n  choliba new project loja --app-dir ./app',
    flags: [
      {
        name: '--app-dir',
        value: { name: 'pasta', suggest: () => ({ kind: 'files' }) },
        description: 'Pasta da aplicação; o nome do projeto sai dela quando falta NOME',
      },
      { name: '--base-url', value: { name: 'url' }, description: 'URL base da aplicação' },
      { name: '--no-input', description: 'Não pergunta nada: o que faltar fica CHANGE_ME' },
      HELP_FLAG,
    ],
  };
}

/** `choliba list projects`: the projects of the projects folder. */
export function listProjectsSpec(): CommandSpec {
  return {
    usage: 'choliba list projects [OPTIONS]',
    description: 'Lista os projetos de CHOL_PROJECTS_DIR.\n\nExemplo:\n  choliba list projects',
    flags: [{ name: '--tickets', description: 'Mostra também os tickets de cada projeto' }, HELP_FLAG],
  };
}
