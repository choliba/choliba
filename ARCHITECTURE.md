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

| Pacote              | O que tem                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`     | a plataforma (o processo e o Bun como valores), a configuração da pasta de trabalho, o tema de cores, o help, o autocomplete, a casca e o runner de processos (`terminal/`) |
| `packages/projects` | projetos e tickets: onde ficam, criar, conferir; o comando `projects`                                                                                                       |
| `packages/runner`   | os testes E2E pelo Playwright, os portões red/green e o reporter; o comando `tests`                                                                                         |
| `packages/agents`   | os agentes: o `agent.yaml`, a montagem de uma execução (`runs/`), os steps, os providers; o comando `agents` e `choliba <agente>`                                           |
| `packages/choliba`  | o app: `main.ts`, a raiz do help, `check`, `setup`, `lint`, `format`; o pacote publicado                                                                                    |

## Invariantes

- **Uma entrada por pacote.** `@choliba/<pkg>` exporta funções, tipos, tokens e o `ShellModule` do pacote. A extra
  é `@choliba/core/testing`, os falsos dos specs. O Playwright carrega o que o runner importa com o próprio Babel,
  que não aceita decorator de parâmetro; a entrada não tem decorator, e o tipo do spawn não cita o global `Bun`
  (a função de verdade é lida só no `main.ts`).
- **Só o `main.ts` lê o Bun e o `process`.** Ele monta o `Platform` (stdout, ambiente, spawn, git…) e o `Runtime`
  (as ferramentas que o choliba roda) e os entrega à casca; todo o resto recebe isso pelo container, e os specs
  passam versões falsas (`@choliba/core/testing`).
- **A lógica fica em funções; a casca registra o que um comando precisa.** Um service é uma classe comum,
  construída por uma fábrica num token. Um comando lê os argumentos como foram digitados (`ShellIo`), chama o
  service e define o código de saída.
- **Nada de decorator nem de metadata.** O container guarda uma fábrica por token (`token<T>()`,
  `container.provide`) e constrói o valor na primeira vez que alguém pede (`container.get`). Só o comando que
  roda constrói o que usa.

## O caminho de um comando

`choliba projects list`: o `main.ts` tira as flags globais (`--no-color`), monta a plataforma e o runtime e chama
`run()`. A raiz trata linha vazia, `help`/`--help`/`-h`, `version`/`--version`, `__complete`, `__describe` e
`__entries`. A primeira palavra `projects` cai no `projectsCommand`, que pede o `ProjectsService` ao container; o
service chama as funções de `projects/project.ts` com a pasta de `LocationsService`; o comando escreve o resultado
e o código de saída pelo `ShellIo`. Uma primeira palavra que não é comando (`choliba product-owner …`) cai no
fallback do `agentsShell`, que a roda como `choliba agents product-owner …`. Sem fallback, a palavra é erro de uso.

Um agente roda num só ponto, `runAgent` (`agents/runs/run-agent.ts`), que inicia o processo do provider. Com
`CHOL_SANDBOX=docker`, o lançador (`agents/runs/sandbox-launch.ts`) troca esse comando por um `docker run` cujas
montagens saem das permissões do agente (`common/sandbox/`): fora delas, nada da máquina existe para o provider.

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
  `runnerShell`) com as fábricas e os comandos. O app os lista, nessa ordem, em `CHOLIBA_SHELL`
  (`packages/choliba/src/app-shell.ts`) e acrescenta por último o `cholibaShell(runtime)`, com `check`, `lint`,
  `format` e `setup`. Um comando novo entra no módulo do pacote dele, não nessa lista.
- **O que o `core` dá a todos.** O `coreShell` registra `CONFIG` (um `ConfigService`) e `THEME` (um
  `ThemeService`) a partir de `PLATFORM`, que o `createShell` registra com a plataforma que o `main.ts` montou. A
  fábrica de outro pacote pede o que precisa, como `container.get(CONFIG)`. O `Runtime` do app entra pelo token
  `RUNTIME`, e só o `cholibaShell` o registra.
- **Uma raiz por app.** O `cholibaShell` tem `root`: o texto do `--help`, a linha do `--version`, a ordem das
  seções (`Commands`, `Agents`) e a ordem dos comandos (`CHOLIBA_ORDER`). Dois módulos com `root`, dois com
  `fallback`, ou dois comandos com a mesma primeira palavra, é erro na hora de montar a casca.
- **Já na casca, todos.** `agents` (os providers são a lista de classes em `agentsShell`; o fallback é
  `choliba <agente>`), `projects`, `tests` (o `runner` só procura a configuração do Playwright quando os testes
  rodam), os comandos do app e o `terminal run`.

Nos specs, `runShell(modules, platform, [replace(TOKEN, fake)])` monta a casca desses módulos, aplica os falsos e
devolve o código de saída.

## `.choliba/` e `.agents/`

`.choliba/` é o layout de uma pasta de trabalho: `agents/`, `skills/` e `mcps/`. Neste repositório ela guarda o
que vai para o usuário: os agentes oficiais e as skills que eles nomeiam, que ele instala com
`bunx choliba add github:choliba/choliba --path .choliba/agents/<agente>`. O choliba roda esses mesmos agentes daqui,
pelo layout padrão, sem caso especial. `.agents/` guarda só o ferramental de quem desenvolve o choliba: as skills de
desenvolvimento, que nenhum usuário recebe.
