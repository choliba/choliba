import type { CommandSpec, FlagSpec } from '@choliba/shell';

const HELP_FLAG: FlagSpec = { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true };

/** `choliba new project`: a project from the template; on a terminal, what is missing is asked. */
export function newProjectSpec(): CommandSpec {
  return {
    usage: 'choliba new project [NOME] [OPTIONS]',
    description:
      'Cria um projeto de teste a partir do modelo e pergunta no terminal o que faltar, como a pasta e a URL da aplicação.',
    examples: [
      {
        description: 'Cria o projeto loja para a aplicação em ./app',
        command: 'choliba new project loja --app-dir ./app --base-url http://localhost:3000',
      },
      { description: 'Cria o projeto sem perguntar nada', command: 'choliba new project loja --no-input' },
    ],
    details: [
      'Cria `projects/<nome>/` (em `CHOL_PROJECTS_DIR`) com `config.json`, `.env.example.json`, `tests/` e `tickets/`.',
      'O nome sai da pasta da aplicação quando falta NOME, e o `description` vem do README dela. Num terminal, o que',
      'faltar é perguntado; uma resposta vazia, ou `--no-input`, deixa o campo como `CHANGE_ME`. Depois, copie o',
      '`.env.example.json` para `.env.json`, troque os `CHANGE_ME` e confira com `choliba check <nome>`. Os formatos estão em',
      '[`config.json` do projeto](../referencia/config-json.md) e [`.env.json` do projeto](../referencia/env-json.md), e o',
      'passo a passo em',
      '[Do zero ao primeiro ticket](../guias/do-zero-ao-primeiro-ticket.md).',
    ].join('\n'),
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
    description: 'Lista os projetos da pasta configurada em CHOL_PROJECTS_DIR e, com --tickets, os tickets de cada um.',
    examples: [
      { description: 'Lista os projetos, com a descrição de cada um', command: 'choliba list projects' },
      { description: 'Lista os projetos com os tickets de cada um', command: 'choliba list projects --tickets' },
    ],
    details:
      'Com `--tickets`, cada projeto sai numa linha `projeto ["chave", …]`, o formato que o `product-owner` lê para ' +
      'conhecer os outros tickets do projeto.',
    flags: [{ name: '--tickets', description: 'Mostra também os tickets de cada projeto' }, HELP_FLAG],
  };
}
