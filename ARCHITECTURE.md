# Arquitetura

Como o código do choliba é organizado, para quem vai mexer nele. Como usar o choliba está no
[README](README.md) e em [`docs/`](docs/README.md); as regras de cada padrão estão nas skills de
[`.agents/skills/`](.agents/skills/) (veja [CONTRIBUTING.md](CONTRIBUTING.md#padrões-do-projeto)).

## Visão geral

O choliba é um monorepo Bun (`packages/*`), sem HTTP. Cada pacote é uma biblioteca com uma entrada,
`@choliba/<pkg>` (`src/index.ts`). `packages/choliba` é o único app: o `main.ts` monta a plataforma e o runtime e
chama `createCholibaShell(platform, runtime).run()`. A linha de comando fica em `packages/shell/src/shell/`:
um container e uma tabela de comandos, sem decorator e sem reflection.

## Os pacotes

| Pacote               | O que tem                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/config`    | o mecanismo independente de configuração: grupos tipados, fontes, formatos e escrita; não conhece nenhuma chave do choliba                                        |
| `packages/kernel`    | container, plataforma, erros esperados, caminhos básicos e fakes para specs                                                                                       |
| `packages/shell`     | a casca, help, autocomplete, tema, terminal e renderização de eventos; referência pública em [`packages/choliba/core/README.md`](packages/choliba/core/README.md) |
| `packages/tui`       | os componentes reutilizáveis do painel e a interface de projetos                                                                                                  |
| `packages/domain`    | regras puras de agentes, permissões, projetos, tickets, vereditos e runs                                                                                          |
| `packages/workspace` | layout e operações de arquivo para agentes, projetos e tickets                                                                                                    |
| `packages/engine`    | preparação e execução de agentes, steps, guardas e instalação                                                                                                     |
| `packages/providers` | adaptadores dos providers de agentes                                                                                                                              |
| `packages/runner`    | os testes E2E pelo Playwright, os portões red/green e o reporter; `run tests`                                                                                     |
| `packages/sandbox`   | onde o provider roda: `local` ou `docker`, as montagens do container e as regras de caminho; depende de `kernel` e `config`                                       |
| `packages/choliba`   | o app: composição, comandos, painéis específicos, configuração, `check`, `setup`, `lint`, `format`, a biblioteca para scripts e o pacote publicado                |

## Invariantes

- **Uma entrada por pacote.** `@choliba/<pkg>` exporta funções, tipos, tokens e o `ShellModule` do pacote. As
  entradas extras internas são `@choliba/kernel/testing` e `@choliba/shell/testing`. O Playwright carrega o que o runner importa com o próprio Babel,
  que não aceita decorator de parâmetro; a entrada não tem decorator, e o tipo do spawn não cita o global `Bun`
  (a função de verdade é lida só no `main.ts`). O pacote instalado republica cada entrada como subcaminho
  (`choliba`, `choliba/core`, `choliba/core/testing`, `choliba/agents`, `choliba/projects`, `choliba/runner`,
  `choliba/sandbox`, `choliba/runner/env`, `choliba/runner/pages/base-page`, `choliba/eslint`), experimental até a
  1.0.
  `import 'choliba'` é a casca e não roda o `main.ts`. Quem mexe neste repositório continua importando
  `@choliba/<pkg>`.
- **Só o `main.ts` lê o Bun e o `process`.** Ele monta o `Platform` (stdout, ambiente, spawn, git…) e o `Runtime`
  (as ferramentas que o choliba roda) e os entrega à casca; todo o resto recebe isso pelo container, e os specs
  usam as versões falsas de `@choliba/kernel/testing` e `@choliba/shell/testing`.
- **Cada nome de pasta e de arquivo tem um dono.** `workspace` define os nomes e resolve os caminhos de `.choliba/`,
  do cache, de projetos, tickets e da raiz da pasta de trabalho. O `kernel` não conhece o layout do choliba.
- **A lógica fica em funções; a casca registra o que um comando precisa.** Um service é uma classe comum,
  construída por uma fábrica num token. Um comando lê os argumentos como foram digitados (`ShellIo`), chama o
  service e define o código de saída.
- **Nada de decorator nem de metadata.** O container guarda uma fábrica por token (`token<T>()`,
  `container.provide`) e constrói o valor na primeira vez que alguém pede (`container.get`). Só o comando que
  roda constrói o que usa.

## O caminho de um comando

`choliba list projects`: o `main.ts` tira as flags globais (`--no-color`), monta a plataforma e o runtime e chama
`run()`. A raiz trata linha vazia, `help`/`--help`/`-h`, `version`/`--version`, `__complete`, `__describe` e
`__entries`. A primeira palavra `list` é um verbo da raiz, e a segunda, `projects`, é o tipo registrado pelo app.
O comando pede o `ProjectsService` ao container; o service combina as regras de `domain` com as operações de arquivo
de `workspace`; o comando escreve o
resultado e o código de saída pelo `ShellIo`. Uma palavra que não é comando, verbo ou tipo (`choliba product-owner`)
é erro de uso, com a sugestão do nome mais parecido; não há fallback.

Um agente roda num só ponto, `runAgent` (`engine/runs/run-agent.ts`), que inicia o processo do provider. Com
`CHOL_SANDBOX=docker`, o lançador (`engine/runs/sandbox-launch.ts`) troca esse comando por um `docker run` cujas
montagens saem das permissões do agente (`@choliba/sandbox`): fora delas, nada da máquina existe para o provider.

Detalhes e as receitas (um comando novo, um provider novo, um spec): skill
[`cli-shell`](.agents/skills/cli-shell/SKILL.md).

## A casca

`packages/shell/src/shell/`:

- **Container.** Tokens comparados por identidade. Uma fábrica por token; dois registros do mesmo token, ou um
  ciclo entre fábricas, é erro. `container.override` coloca um falso no lugar da fábrica, que é o que o spec faz.
- **Tabela de comandos.** Um `ShellCommand` tem a primeira palavra (`name`), os aliases, as entradas da help da
  raiz (`help`, lidas de novo a cada vez) e o `run(container, io)`. Um comando sem `help` não aparece no
  `--help`: é o caso de `terminal`, no `baseShell`.
- **Composição no app.** `CHOLIBA_SHELL` (`packages/choliba/src/app-shell.ts`) lista os módulos que registram os
  serviços, painéis e comandos do choliba. `baseShell` vem de `shell`, `tuiShell` de `tui`, `runnerShell` de
  `runner`; os módulos dos agentes, projetos, testes e do painel de agentes ficam no app. A casca acrescenta por
  último `cholibaShell(runtime)`, com `check`, `lint`, `format` e `setup`.
- **Configuração composta pelo app.** Cada pacote declara suas próprias chaves com `defineConfig` e lê o objeto
  tipado pelo token do grupo. O `createShell` reúne esses grupos em `CONFIG_CATALOG` e registra a leitura
  preguiçosa. O app encontra a pasta de trabalho, fornece `WORKSPACE_ROOT` e ordena as fontes: ambiente primeiro,
  depois o `.env`. `list config` e `set config` pertencem ao app. `baseShell` registra o tema e o app entrega as
  escolhas de `CHOL_COLORS` por `THEME_CHOICES`.
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
`bun choliba add github:choliba/choliba --path .choliba/agents/<agente>`. O choliba roda esses mesmos agentes daqui,
pelo layout padrão, sem caso especial. `.agents/` guarda só o ferramental de quem desenvolve o choliba: as skills de
desenvolvimento, que nenhum usuário recebe.
