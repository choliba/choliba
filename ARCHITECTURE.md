# Arquitetura

Como o código do choliba é organizado, para quem vai mexer nele. Como usar o choliba está no
[README](README.md) e em [`docs/`](docs/README.md); as regras de cada padrão estão nas skills de
[`.agents/skills/`](.agents/skills/) (veja [CONTRIBUTING.md](CONTRIBUTING.md#padrões-do-projeto)).

## Visão geral

O choliba é um monorepo Bun (`packages/*`) construído sobre NestJS 11 e nest-commander, sem HTTP: o Nest dá os
módulos e a injeção de dependências, o nest-commander transforma os módulos na linha de comando `choliba`. Cada
pacote é uma biblioteca Nest; `packages/choliba` é o único app.

## Os pacotes

| Pacote              | O que tem                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`     | a plataforma (o processo e o Bun como valores injetáveis), a configuração da pasta de trabalho, o tema de cores, o help e o autocomplete       |
| `packages/terminal` | rodar processos com a saída rotulada (`ProcessRunnerService`) e o comando oculto `terminal run`                                                |
| `packages/projects` | projetos e tickets: onde ficam, criar, conferir; o comando `projects`                                                                          |
| `packages/runner`   | os testes E2E pelo Playwright, os portões red/green e o reporter; o comando `tests`                                                            |
| `packages/agents`   | os agentes: o `agent.yaml`, a montagem de uma execução (`runs/`), os steps, os providers; o comando `agents` e `choliba <agente>`              |
| `packages/choliba`  | o app: `AppModule`, `main.ts`, o help da raiz, `install`, `check`, `setup`, `lint`, `format`, `playwright-*`, `completion`; o pacote publicado |

## Invariantes

- **Duas entradas por pacote.** `@choliba/<pkg>` exporta só funções e tipos; `@choliba/<pkg>/nest`, os módulos,
  services e comandos. O Playwright carrega o código do runner (e o que ele importa) com o próprio Babel, que não
  aceita decorators de parâmetro; um spec do runner falha se algum chegar lá.
- **Só o `main.ts` lê o Bun e o `process`.** Ele monta o `Platform` (stdout, ambiente, spawn, git…) e o `Runtime`
  (as ferramentas que o choliba roda) e os entrega ao `AppModule`; todo o resto recebe isso injetado, e os specs
  passam versões falsas (`@choliba/core/testing`).
- **A lógica fica em funções; o Nest é a casca.** Um service injeta o que precisa e chama as funções da sua pasta;
  um comando lê os argumentos como foram digitados (`CommandIo`), chama o service e define o código de saída.
- **Toda dependência é declarada com `@Inject`.** Não há metadata de decorators (ela quebraria a cobertura no
  Jest), então o Nest só sabe o que injetar pelo `@Inject` de cada parâmetro.

## O caminho de um comando

`choliba projects list-projects`: o `main.ts` tira as flags globais (`--no-color`), monta a plataforma e roda o
`AppModule`; o nest-commander despacha para o `ListProjectsCommand`, que pede ao `ProjectsService` a lista, que
chama as funções de `projects/project.ts` com a pasta de `LocationsService`; o comando escreve o resultado e o
código de saída pelo `CommandIo`. Uma primeira palavra que não é comando (`choliba product-owner …`) cai no comando
da raiz, que a passa para o `AgentsService`.

Detalhes, receitas (um comando novo, um provider novo) e os testes: skill [`nestjs`](.agents/skills/nestjs/SKILL.md).
