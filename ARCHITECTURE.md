# Arquitetura

Como o código do choliba é organizado, para quem vai mexer nele. Como usar o choliba está no
[README](README.md) e em [`docs/`](docs/README.md); as regras de cada padrão estão nas skills de
[`.agents/skills/`](.agents/skills/) (veja [CONTRIBUTING.md](CONTRIBUTING.md#padrões-do-projeto)).

## Visão geral

O choliba é um monorepo Bun (`packages/*`), sem HTTP. Cada pacote é uma biblioteca com uma entrada,
`@choliba/<pkg>` (`src/index.ts`). `packages/choliba` é o único app: o `main.ts` monta a plataforma e o runtime e
chama `createCholibaShell(platform, runtime).run()`. A linha de comando é a casca em `packages/core/src/shell/`:
um container e uma tabela de comandos, sem decorator e sem reflection.

## Os pacotes

| Pacote              | O que tem                                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/config`   | o mecanismo independente de configuração: grupos tipados, fontes, formatos e escrita; não conhece nenhuma chave do choliba                                                                                  |
| `packages/core`     | a plataforma (o processo e o Bun como valores), o tema de cores, o help, o autocomplete, a casca e o runner de processos (`terminal/`); guia de uso em [`packages/core/README.md`](packages/core/README.md) |
| `packages/projects` | projetos e tickets: onde ficam, criar, conferir; `new project` e `list projects`                                                                                                                            |
| `packages/runner`   | os testes E2E pelo Playwright, os portões red/green e o reporter; `run tests`                                                                                                                               |
| `packages/sandbox`  | onde o provider roda: `local` ou `docker` (`sandbox/local/`, `sandbox/docker/`), as montagens do container e as regras de caminho (`deny`, exceções `!`); só depende do `core`                              |
| `packages/agents`   | os agentes: o `agent.yaml`, a montagem de uma execução (`runs/`), os steps, os providers; `run agent` e `list agents`                                                                                       |
| `packages/choliba`  | o app: `main.ts`, a pasta de trabalho, as fontes de configuração, `list config`, `set config`, a raiz, `check`, `setup`, `lint` e `format`; o pacote publicado                                              |

## Invariantes

- **Uma entrada por pacote.** `@choliba/<pkg>` exporta funções, tipos, tokens e o `ShellModule` do pacote. A extra
  é `@choliba/core/testing`, os falsos dos specs. O Playwright carrega o que o runner importa com o próprio Babel,
  que não aceita decorator de parâmetro; a entrada não tem decorator, e o tipo do spawn não cita o global `Bun`
  (a função de verdade é lida só no `main.ts`). O pacote instalado republica cada entrada como subcaminho
  (`choliba`, `choliba/core`, `choliba/core/testing`, `choliba/agents`, `choliba/projects`, `choliba/runner`,
  `choliba/sandbox`, `choliba/runner/env`, `choliba/runner/pages/base-page`, `choliba/eslint`), experimental até a
  1.0.
  `import 'choliba'` é a casca e não roda o `main.ts`. Quem mexe neste repositório continua importando
  `@choliba/<pkg>`.
- **Só o `main.ts` lê o Bun e o `process`.** Ele monta o `Platform` (stdout, ambiente, spawn, git…) e o `Runtime`
  (as ferramentas que o choliba roda) e os entrega à casca; todo o resto recebe isso pelo container, e os specs
  passam versões falsas (`@choliba/core/testing`).
- **Cada nome de pasta e de arquivo tem um dono.** O `agents` define os de `.choliba/`, do cache e das execuções
  (`agents/agent-layout.ts`), o `projects` os de projetos e tickets (`paths/project-layout.ts`) e o app os da raiz
  da pasta de trabalho (`config/workspace-layout.ts`). O `core` não conhece o layout do choliba.
- **A lógica fica em funções; a casca registra o que um comando precisa.** Um service é uma classe comum,
  construída por uma fábrica num token. Um comando lê os argumentos como foram digitados (`ShellIo`), chama o
  service e define o código de saída.
- **Nada de decorator nem de metadata.** O container guarda uma fábrica por token (`token<T>()`,
  `container.provide`) e constrói o valor na primeira vez que alguém pede (`container.get`). Só o comando que
  roda constrói o que usa.

## O caminho de um comando

`choliba list projects`: o `main.ts` tira as flags globais (`--no-color`), monta a plataforma e o runtime e chama
`run()`. A raiz trata linha vazia, `help`/`--help`/`-h`, `version`/`--version`, `__complete`, `__describe` e
`__entries`. A primeira palavra `list` é um verbo da raiz, e a segunda, `projects`, é o tipo que o pacote
`projects` registrou nele (`listProjectsCommand`, com `verb: 'list'`). O comando pede o `ProjectsService` ao
container; o service chama as funções de `projects/project.ts` com a pasta de `LocationsService`; o comando escreve o
resultado e o código de saída pelo `ShellIo`. Uma palavra que não é comando, verbo ou tipo (`choliba product-owner`)
é erro de uso, com a sugestão do nome mais parecido; não há fallback.

Um agente roda num só ponto, `runAgent` (`agents/runs/run-agent.ts`), que inicia o processo do provider. Com
`CHOL_SANDBOX=docker`, o lançador (`agents/runs/sandbox-launch.ts`) troca esse comando por um `docker run` cujas
montagens saem das permissões do agente (`@choliba/sandbox`): fora delas, nada da máquina existe para o provider.

Detalhes e as receitas (um comando novo, um provider novo, um spec): skill
[`cli-shell`](.agents/skills/cli-shell/SKILL.md).

## A casca

`packages/core/src/shell/`:

- **Container.** Tokens comparados por identidade. Uma fábrica por token; dois registros do mesmo token, ou um
  ciclo entre fábricas, é erro. `container.override` coloca um falso no lugar da fábrica, que é o que o spec faz.
- **Tabela de comandos.** Um `ShellCommand` tem a primeira palavra (`name`), os aliases, as entradas da help da
  raiz (`help`, lidas de novo a cada vez) e o `run(container, io)`. Um comando sem `help` não aparece no
  `--help`: é o caso de `terminal`, no `coreShell`.
- **Um módulo por pacote.** Cada pacote exporta um `ShellModule` (`coreShell`, `agentsShell`, `projectsShell`,
  `runnerShell`) com as fábricas, os comandos e os grupos de configuração que consome. O app os lista, nessa ordem, em `CHOLIBA_SHELL`
  (`packages/choliba/src/app-shell.ts`) e acrescenta por último o `cholibaShell(runtime)`, com `check`, `lint`,
  `format` e `setup`. Um comando novo entra no módulo do pacote dele, não nessa lista.
- **Configuração composta pelo app.** Cada pacote declara suas próprias chaves com `defineConfig` e lê o objeto
  tipado pelo token do grupo. O `createShell` reúne esses grupos em `CONFIG_CATALOG` e registra a leitura
  preguiçosa. O app encontra a pasta de trabalho, fornece `WORKSPACE_ROOT` e ordena as fontes: ambiente primeiro,
  depois o `.env`. `list config` e `set config` pertencem ao app. O `coreShell` registra apenas `THEME`; o app
  entrega as escolhas de `CHOL_COLORS` por `THEME_CHOICES`.
- **Runtime do app.** O `Runtime` entra pelo token `RUNTIME`, e só o `cholibaShell` o registra.
- **Uma raiz por app.** O `cholibaShell` tem `root`: o texto do `--help`, a linha do `--version`, a ordem dos
  comandos (`CHOLIBA_ORDER`) e os verbos (`CHOLIBA_VERBS`: `run`, `new`, `list`). Cada pacote registra os seus tipos
  sob um verbo (`run agent`, `run tests`, `new project`, `list agents`, `list projects`), e a casca monta o verbo com
  eles. Dois módulos com `root`, um verbo que também é comando, um comando sob um verbo que a raiz não tem, ou dois
  comandos com a mesma palavra, é erro na hora de montar a casca.
- **Já na casca, todos.** `run agent` e `list agents` (os providers são a lista de classes em `agentsShell`),
  `new project` e `list projects`, `run tests` (o `runner` só procura a configuração do Playwright quando os testes
  rodam), os comandos do app e o `terminal run`.

Nos specs, `runShell(modules, platform, [replace(TOKEN, fake)])` monta a casca desses módulos, aplica os falsos e
devolve o código de saída. O spec de um pacote cujos comandos ficam sob um verbo acrescenta `VERBS_ROOT`, uma raiz
com os verbos do app.

## `.choliba/` e `.agents/`

`.choliba/` é o layout de uma pasta de trabalho: `agents/`, `skills/` e `mcps/`. Neste repositório ela guarda o
que vai para o usuário: os agentes oficiais e as skills que eles nomeiam, que ele instala com
`bunx choliba add github:choliba/choliba --path .choliba/agents/<agente>`. O choliba roda esses mesmos agentes daqui,
pelo layout padrão, sem caso especial. `.agents/` guarda só o ferramental de quem desenvolve o choliba: as skills de
desenvolvimento, que nenhum usuário recebe.
