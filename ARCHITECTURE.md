# Arquitetura

Como o código do choliba é organizado, para quem vai mexer nele. Como usar o choliba está no
[README](README.md) e em [`docs/`](docs/README.md); as regras de cada padrão estão nas skills de
[`.agents/skills/`](.agents/skills/) (veja [CONTRIBUTING.md](CONTRIBUTING.md#padrões-do-projeto)).

## Visão geral

O choliba é um monorepo Bun (`packages/*`) construído sobre NestJS 11 e nest-commander, sem HTTP: o Nest dá os
módulos e a injeção de dependências, o nest-commander transforma os módulos na linha de comando `choliba`. Cada
pacote é uma biblioteca Nest; `packages/choliba` é o único app.

## Os pacotes

| Pacote              | O que tem                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`     | a plataforma (o processo e o Bun como valores injetáveis), a configuração da pasta de trabalho, o tema de cores, o help e o autocomplete                                          |
| `packages/terminal` | rodar processos com a saída rotulada (`ProcessRunnerService`) e o comando oculto `terminal run`                                                                                   |
| `packages/projects` | projetos e tickets: onde ficam, criar, conferir; o comando `projects`                                                                                                             |
| `packages/runner`   | os testes E2E pelo Playwright, os portões red/green e o reporter; o comando `tests`                                                                                               |
| `packages/agents`   | os agentes: o `agent.yaml`, a montagem de uma execução (`runs/`, com as ferramentas da run em `runs/run-tools/`), os steps, os providers; o comando `agents` e `choliba <agente>` |
| `packages/choliba`  | o app: `AppModule`, `main.ts`, o help da raiz, `install`, `check`, `setup`, `lint`, `format`, `completion`; o pacote publicado                                                    |

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

`choliba projects list`: o `main.ts` tira as flags globais (`--no-color`), monta a plataforma e roda o
`AppModule`; o nest-commander despacha para o `ProjectsListCommand`, que pede ao `ProjectsService` a lista, que
chama as funções de `projects/project.ts` com a pasta de `LocationsService`; o comando escreve o resultado e o
código de saída pelo `CommandIo`. Uma primeira palavra que não é comando (`choliba product-owner …`) cai no comando
da raiz, que a passa para o `AgentsService`.

Detalhes, receitas (um comando novo, um provider novo) e os testes: skill [`nestjs`](.agents/skills/nestjs/SKILL.md).

## `.choliba/` e `.agents/`

`.choliba/` é o layout de uma pasta de trabalho instalada: `agents/`, `skills/` e `mcps/`, vazios até alguém
colocar os seus. Este repositório roda os próprios agentes a partir de `.agents/agents/`, e as skills que eles
nomeiam a partir de `.agents/skills/` (ao lado das skills de desenvolvimento). A resolução usa essa pasta quando
ela existe e `CHOL_AGENTS_DIR` não foi definido; numa pasta instalada, sem `.agents/agents/`, continua
`.choliba/`.

## A casca sem Nest (em transição)

O boot do Nest custa uns 220 ms a cada comando (veja [PERFORMANCE.md](PERFORMANCE.md)), e os comandos estão saindo
dele, um pacote por vez, para uma casca sem decorators em `packages/core/src/shell/`:

- **Container.** Cada pacote registra uma fábrica por token (`token<T>()`, `container.provide`); um serviço é
  construído na primeira vez que um comando pede (`container.get`) e reaproveitado depois. Só o comando que roda
  constrói o que usa.
- **Tabela de comandos.** Um `ShellCommand` tem a primeira palavra que o roda, as entradas na help da raiz (`help`) e
  o `run(container, io)`; o `ShellIo` tem o mesmo contrato do `CommandIo`.
- **Um módulo por pacote.** Cada pacote exporta o seu `ShellModule` (`coreShell`, `agentsShell`, `projectsShell`,
  `runnerShell`, `terminalShell`) com os seus serviços e comandos, e o app os lista numa ordem fixa em
  `packages/choliba/src/app-shell.ts`. Mover um comando para a casca só mexe no pacote dele.

Enquanto os dois convivem, o `main.ts` roda pela casca um comando cuja primeira palavra está na tabela, sem checar
decorators, e manda todo o resto para o Nest. A help da raiz, `__complete`, `__describe` e `__entries` continuam no
Nest e listam também as entradas da casca, na ordem de `CHOLIBA_ORDER`, para a help não mudar quando um comando
muda de lado. Nos specs, `runShell(modules, platform, [replace(TOKEN, fake)])` faz para a casca o que o `runCommand`
faz para o Nest.
