# choliba

[![CI](https://github.com/jacksonbicalho/choliba/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/jacksonbicalho/choliba/actions/workflows/ci.yml)
[![cobertura](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/jacksonbicalho/choliba/develop/.github/badges/coverage.json)](COVERAGE.md)
[![release](https://img.shields.io/github/v/release/jacksonbicalho/choliba?include_prereleases)](https://github.com/jacksonbicalho/choliba/releases/tag/v0.0.1-dev)
[![licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)
[![standard-readme](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg)](https://github.com/RichardLitt/standard-readme)

Testes E2E multiprojeto com Playwright, operados por agentes.

O choliba organiza os testes de ponta a ponta de várias aplicações em **projetos** (a URL de cada ambiente, as
credenciais de teste e os specs) e **tickets** (o que muda na aplicação, com critérios de aceite). Agentes de IA
fazem o trabalho em etapas: o `product-owner` escreve o ticket usando a aplicação no navegador, o `test-writer`
transforma cada critério num teste que falha, e o `implementer` muda a aplicação até os testes passarem.

Quem garante a disciplina é a ferramenta, não o prompt: portões conferem que os testes falham antes e passam
depois, e cada agente só lê, escreve e roda o que o seu `agent.yaml` libera. Tudo roda numa pasta de trabalho, que
o pacote cria ao ser instalado.

## Índice

- [Segurança](#segurança)
- [Contexto](#contexto)
- [Instalação](#instalação)
  - [Dependências](#dependências)
  - [`choliba setup`](#choliba-setup)
  - [Atualização](#atualização)
- [Uso](#uso)
  - [CLI](#cli)
- [A pasta de trabalho](#a-pasta-de-trabalho)
- [Escrevendo um agente](#escrevendo-um-agente)
- [Portões dos testes de um ticket](#portões-dos-testes-de-um-ticket)
- [`choliba install`](#choliba-install)
  - [O que o repositório do choliba oferece](#o-que-o-repositório-do-choliba-oferece)
  - [Exemplos](#exemplos)
- [`.env` da pasta de trabalho](#env-da-pasta-de-trabalho)
- [Autocomplete](#autocomplete)
- [Mantenedores](#mantenedores)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Segurança

Os agentes rodam comandos e mexem em arquivos, então o choliba restringe o que cada um alcança, a partir do
`permissions` do [`agent.yaml`](#escrevendo-um-agente):

- **Negado por padrão, em qualquer lugar.** O agente só lê, escreve e roda o que está em `permissions.allow`, no
  workspace ou fora dele; `deny` prevalece sobre `allow`. O choliba escreve as permissões no prompt e as aplica no
  provider. Cada execução roda numa pasta vazia, `.cache/runs/<id>/`, criada antes e apagada depois, porque os dois
  providers liberam tudo na pasta em que rodam. No Claude, as regras dizem exatamente onde ele lê e escreve, e ele
  só tem as ferramentas que as permissões pedem. No Cursor, que não trata `allow` como limite, o choliba gera um
  `deny` para todo o resto do disco. Limite do Cursor: um arquivo **novo**, criado direto numa pasta do caminho até
  um item liberado (a raiz do workspace, por exemplo), não é bloqueado.
- **Caminhos.** Caminho relativo é relativo à raiz do workspace. As pastas das skills declaradas ficam liberadas para
  leitura sozinhas. Num glob, o Cursor libera a pasta antes dele inteira.
- **Execução por diretório.** Os comandos rodam a partir da pasta da execução, dentro do workspace (por isso
  `bunx choliba ...` funciona sem `cd`). Um diretório de `execute` fora do workspace precisa estar em `allow.read`,
  porque rodar comandos nele já dá acesso ao que há lá. Os providers aplicam em que diretórios o agente entra e
  quais comandos roda, mas não o vínculo "este comando só neste diretório": na prática vale a união dos dois.
- **`steps` não passam pelas permissões.** Os passos são executados pelo choliba, fora da sessão do modelo: um
  passo pode fazer o que o modelo não pode (o `docs-updater` proíbe o modelo de rodar o Prettier e o roda num
  `steps.after`).

## Contexto

Testar várias aplicações com Playwright costuma espalhar specs, URLs e credenciais; e pedir a um agente de IA que
"faça TDD" não garante que ele escreva o teste antes, nem que não o afrouxe para passar. O choliba junta os testes
por projeto e ticket e divide o trabalho entre agentes com papéis e permissões separados, com a conferência do
red e do green feita pelo próprio CLI.

Ele depende do [Playwright](https://playwright.dev) (os testes e o navegador que os agentes usam, via
`playwright cli`), do [Bun](https://bun.sh) e de um provider de agente: o [Claude Code](https://claude.com/claude-code)
ou o Cursor (`cursor-agent`). Agentes podem usar skills e servidores MCP, instalados na pasta de trabalho.

## Instalação

O choliba não está no npm: o pacote é o `.tgz` da pré-release
[`v0.0.1-dev`](https://github.com/jacksonbicalho/choliba/releases/tag/v0.0.1-dev), que é refeita a cada merge na
`master` (o endereço não muda).

```
bun add --trust https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

O `--trust` deixa o Bun rodar o `postinstall` do pacote, que já executa `choliba setup` (veja abaixo). Sem
`--trust`, instale e rode o setup à mão:

```
bun add https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
bunx choliba setup
```

### Dependências

- [Bun](https://bun.sh) (o choliba roda com ele).
- Os navegadores do Playwright, uma vez por máquina:

  ```
  bunx playwright install chromium
  ```

- Para rodar agentes, o CLI de um provider instalado e autenticado: `claude` (Claude Code) ou `cursor-agent`.

### `choliba setup`

Roda sozinho no `postinstall` (com `--trust`) ou à mão (`bunx choliba setup`). Sem sobrescrever o que já existe,
ele:

- cria `app/agents/`, `app/.agents/skills/`, `app/.agents/mcps/` e `projects/` na pasta de trabalho;
- copia de um template `.env.example`, `.gitignore`, `.editorconfig` (largura e indentação, que o Prettier lê) e os
  arquivos do Prettier e do ESLint, e cria o `.env` inicial com `CHOL_GLOBAL_DIR` apontando para
  `.cache/choliba` e `PROJECTS_DIR` para `projects/`, os dois da própria pasta de trabalho;
- lista `choliba` em `trustedDependencies` do `package.json`, para que instalações futuras rodem o setup de novo
  sem pedir `--trust`;
- liga o autocomplete do bash (veja abaixo).

### Atualização

A URL da release não muda a cada versão. Para o Bun baixar o pacote novo (e não reaproveitar o do cache), remova e
instale de novo:

```
bun remove choliba
bun add --trust https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

## Uso

Numa pasta de trabalho com o choliba instalado, do projeto ao código implementado:

```sh
# um projeto para a aplicação em ../minha-app, e os agentes do repositório do choliba
bunx choliba projects create-project minha-app --app-dir ../minha-app --base-url http://localhost:3000
bunx choliba install github:jacksonbicalho/choliba --path agents/product-owner
bunx choliba install github:jacksonbicalho/choliba --path agents/test-writer
bunx choliba install github:jacksonbicalho/choliba --path agents/implementer
bunx choliba check

# o ticket, os testes e a implementação
bunx choliba product-owner --project minha-app --type story "a busca aceita filtro por data"
bunx choliba test-writer --project minha-app --ticket minha-app-1
bunx choliba implementer --project minha-app --ticket minha-app-1

# os testes do ticket, a qualquer momento
bunx choliba tests minha-app:1
```

### CLI

| Comando                                      | O que faz                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `choliba agents COMMAND [OPTIONS] [TASK...]` | Roda um agente da pasta de trabalho (`agents/<nome>/`)                                                    |
| `choliba <agente>`                           | Atalho para `choliba agents <agente>`                                                                     |
| `choliba projects COMMAND [ARGS]`            | Cria e lista projetos e tickets em `PROJECTS_DIR`                                                         |
| `choliba tests [PROJECT[:TICKET]] [OPTIONS]` | Roda os testes E2E dos projetos com o Playwright                                                          |
| `choliba playwright-cli COMMAND [ARGS]`      | O navegador que os agentes usam (`playwright cli`)                                                        |
| `choliba install <origem> [OPTIONS]`         | Instala um agente (com suas skills e MCPs), uma skill ou um MCP numa pasta, repositório git ou pacote npm |
| `choliba setup`                              | Cria a pasta de trabalho e liga o autocomplete (roda sozinho ao instalar com `--trust`)                   |
| `choliba completion bash`                    | Imprime o script de autocomplete do bash                                                                  |

`choliba --help` (ou `choliba COMMAND --help`) lista o mesmo, sempre a partir do binário instalado.

## A pasta de trabalho

`choliba` roda sempre numa **pasta de trabalho**: a pasta, subindo a partir de onde o comando é chamado, cujo
`package.json` depende de `choliba` (é o que `bun add choliba` cria). É nela que ficam o `.env`, os agentes
(`app/agents/`), as skills (`app/.agents/skills/`) e os MCPs (`app/.agents/mcps/`) usados pelos comandos. Rodar
`choliba` de qualquer subpasta dela funciona do mesmo jeito. Essas três pastas são o padrão; `CHOL_AGENTS_DIR`,
`CHOL_SKILLS_DIR` e `CHOL_MCPS_DIR` no `.env` apontam para outras.

## Escrevendo um agente

Um agente é uma pasta `agents/<id>/` com dois arquivos:

- `agent.yaml`: o que o choliba lê e aplica (identidade, modelos, permissões, modos, passos);
- `system.md`: as instruções que o modelo lê, em XML com as seções `system_role`, `tool_definitions`,
  `input_contract`, `docs_map` (opcional), `execution_flow` e `output_contract`, validadas por
  `schemes/agent.xsd`.

O `agent.yaml` segue um padrão versionado. A primeira chave, `version`, é a versão do padrão (hoje só `1`); um
arquivo sem ela ou de outra versão não carrega. O schema é `schemes/v1/agent.schema.json`.

```yaml
version: 1

agent:
  id: qa-e2e # igual ao nome da pasta
  name: QA E2E
  version: 1.0.0 # versão do agente
  description: >-
    O que o agente faz, o que não faz e quando usar.

models: [claude-sonnet-5]
skills: [playwright-cli]
mcps:
  mcp-app:
    tools: [jira_get_issue]

permissions:
  allow:
    read: ['${PROJECT_DIR}/', '${APP_DIR}/']
    write: ['${PROJECT_DIR}/tests/']
    execute:
      '${CHOL_ROOT}/': [bunx choliba tests, bunx choliba playwright-cli]
      '${APP_DIR}/': [git log, git diff]
  deny:
    write: ['${APP_DIR}/']
    execute:
      /etc/: ['*']

modes:
  allow: [execute, plan]
  default: execute

task:
  required: false
  default: Escreva os testes do ticket.

ticket_types: [story, bug, improvement]

steps:
  before:
    - add_files: [ticket, '${TICKET_FILE}']
  after:
    - run: [bunx, choliba, tests, '${PROJECT}:${TICKET}']
```

| Chave                        | Obrigatória | Padrão              | O que é                                                                                                                             |
| ---------------------------- | ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `version`                    | sim         | —                   | Versão do padrão: `1`.                                                                                                              |
| `agent`                      | sim         | —                   | `id` (igual à pasta, é o nome do comando), `name`, `version` (semver do agente) e `description`.                                    |
| `models`                     | sim         | —                   | Modelos com que o agente pode rodar, pelo id que o provider informa.                                                                |
| `skills`                     | não         | `[]`                | Pastas em `app/.agents/skills/`.                                                                                                    |
| `mcps`                       | não         | nenhum              | Lista de nomes de `app/.agents/mcps/<nome>.json` (todas as tools) ou mapa `nome: { tools: [...] }`.                                 |
| `permissions.allow`/`.deny`  | não         | nada liberado       | `read` e `write`: caminhos (terminado em `/` = tudo abaixo). `execute`: diretório → comandos (prefixos com argumentos).             |
| `modes.allow` / `.default`   | não         | os três / `execute` | Modos aceitos (`execute`, `plan`, `ask`) e o usado quando a linha de comando não diz.                                               |
| `task.required` / `.default` | não         | `true` / —          | Se a tarefa é obrigatória e, quando não é, qual usar (`default` passa a ser obrigatório).                                           |
| `ticket_types`               | não         | agente sem ticket   | Tipos de ticket aceitos (`story`, `bug`, `improvement`, `task`); a execução pede `--type` ou `--ticket`.                            |
| `steps.before` / `.after`    | não         | nenhum              | Ações do choliba antes do modelo (`run`, `git_diff`, `add_files`) e depois de um `execute` bem-sucedido (`run`, `record_git_head`). |

Regras de permissão: veja [Segurança](#segurança). Além delas:

- **Variáveis.** Caminhos, comandos e argumentos de passos aceitam `${CHOL_ROOT}` (a pasta de trabalho, sempre
  encontrada pelo choliba: definir `CHOL_ROOT` no `.env` ou no ambiente é erro), `${CHOL_AGENTS_DIR}`,
  `${CHOL_SKILLS_DIR}`, `${CHOL_MCPS_DIR}`, `${CHOL_GLOBAL_DIR}`, `${PROJECTS_DIR}`, `${PROJECT}`, `${PROJECT_DIR}`, `${APP_DIR}`, `${TICKET}` e
  `${TICKET_FILE}`. Uma variável sem valor interrompe a execução.
- **Projeto.** Um agente que usa uma variável de projeto (`${PROJECT}`, `${PROJECT_DIR}`, `${APP_DIR}`,
  `${TICKET}`, `${TICKET_FILE}`) no `agent.yaml` ou no `system.md`, ou declara `ticket_types`, exige `--project`.

## Portões dos testes de um ticket

`choliba tests PROJECT:TICKET --expect red|green [--failures ARQUIVO]` roda os testes de um ticket e confere o que
eles mostram. É assim que os agentes `test-writer` e `implementer` garantem o TDD:

- **`--expect red`**: todo critério do ticket tem teste, nenhum quebra no próprio código nem é pulado, e **pelo
  menos um falha pelo comportamento** (há o que implementar). Um critério cujos testes já passam fica como **já
  atendido**: o teste continua valendo como proteção contra regressão. Se todos passam, o portão recusa (nada a
  implementar).
- **`--expect green`**: todos os testes do ticket passam, inclusive os dos critérios já atendidos.
- **`--failures ARQUIVO`**: grava, em Markdown, os critérios a implementar com a falha de cada teste e, por último,
  os já atendidos. O `test-writer` grava esse arquivo, e o `implementer` começa por ele.

## `choliba install`

Traz um agente (com as skills e os MCPs que ele declara), uma skill ou um MCP para a pasta de trabalho,
substituindo o que já estiver no destino:

```
choliba install <origem> [--path <item na origem>] [--dry-run]
```

- `<origem>` é uma pasta local, um repositório git (`https://…`, `git@…`, `github:dono/repo[#ref]`, ...) ou um
  pacote npm (nome ou `nome@versão`).
- `--path` escolhe o item dentro da origem (ex.: `--path agents/test-writer`), para origens com mais de um agente,
  skill ou MCP. Sem `--path`, a origem já precisa ser o item: uma pasta com `agent.yaml` ou `SKILL.md`, ou um
  arquivo `.json`.
- `--dry-run` mostra o que seria instalado, sem gravar nada.

Instalar um agente também traz as skills e os MCPs que ele declara, quando estão na origem; os que faltam saem
como aviso, para instalar à parte. Se o `.json` de um MCP usa uma variável (`${NOME}`) sem valor no `.env`, isso
também aparece como aviso.

### O que o repositório do choliba oferece

| Tipo   | Caminho na origem                             | Para quê                                                                            |
| ------ | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| agente | `agents/product-owner`                        | Escreve o ticket com critérios de aceite, usando a aplicação no navegador.          |
| agente | `agents/test-writer`                          | Escreve um teste por critério, antes da implementação.                              |
| agente | `agents/implementer`                          | Muda a aplicação até os testes do ticket passarem.                                  |
| agente | `agents/docs-updater`                         | Atualiza a documentação a partir do diff.                                           |
| skill  | `.agents/skills/playwright-cli`               | Ensina o agente a usar o navegador (`choliba playwright-cli`).                      |
| skill  | `.agents/skills/playwright-trace`             | Ensina o agente a ler o `trace.zip` de um teste que falhou.                         |
| skill  | `.agents/skills/playwright-component-testing` | Testes de componente com Playwright.                                                |
| skill  | `.agents/skills/documentation`                | Boas práticas de documentação (usada pelo `docs-updater`).                          |
| MCP    | `.agents/mcps/mcp-app.json`                   | O servidor [mcp-app](https://github.com/jacksonbicalho/mcp-app) (Jira e ambientes). |

### Exemplos

Um agente, com as skills e os MCPs que ele declara (o `product-owner` traz a skill `playwright-cli` e o MCP
`mcp-app`):

```sh
bunx choliba install github:jacksonbicalho/choliba --path agents/product-owner
```

```
Instalado:
  agente product-owner → app/agents/product-owner
  skill playwright-cli → app/.agents/skills/playwright-cli
  MCP mcp-app → app/.agents/mcps/mcp-app.json

Avisos:
  - o MCP mcp-app usa ${MCP_APP_DIR}, ${MCP_APP_LOG_DIR}, sem valor no .env: defina antes de rodar o agente.

Confira com: choliba check
```

Uma skill sozinha:

```sh
bunx choliba install github:jacksonbicalho/choliba --path .agents/skills/playwright-trace
```

Um MCP sozinho, e as variáveis que o `.json` dele usa, no `.env` da pasta de trabalho:

```sh
bunx choliba install github:jacksonbicalho/choliba --path .agents/mcps/mcp-app.json
```

```sh
# .env
MCP_APP_DIR=/home/voce/mcp-app
MCP_APP_LOG_DIR=/home/voce/mcp-app/logs
```

A mesma origem numa branch ou tag, num clone local, ou só para ver o que seria instalado:

```sh
bunx choliba install github:jacksonbicalho/choliba#develop --path agents/test-writer
bunx choliba install ../choliba --path agents/test-writer
bunx choliba install github:jacksonbicalho/choliba --path agents/implementer --dry-run
```

## `.env` da pasta de trabalho

| Variável                    | Para quê                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHOL_GLOBAL_DIR`           | Raiz dos artefatos das execuções e, sem `PROJECTS_DIR`, dos projetos (`CHOL_GLOBAL_DIR/projects`). Preenchida pelo `setup` com `.cache/choliba` da pasta de trabalho.         |
| `PROJECTS_DIR`              | Onde ficam os projetos, se não em `CHOL_GLOBAL_DIR/projects`. Preenchida pelo `setup` com `projects/` da pasta de trabalho.                                                   |
| `TICKET_RUNS`               | Opcional: raiz de `ticket-runs/`, se não for `PROJECTS_DIR`.                                                                                                                  |
| `CHOL_AGENTS_DIR`           | Opcional: pasta dos agentes (padrão `app/agents`).                                                                                                                            |
| `CHOL_SKILLS_DIR`           | Opcional: pasta das skills (padrão `app/.agents/skills`).                                                                                                                     |
| `CHOL_MCPS_DIR`             | Opcional: pasta dos MCPs (padrão `app/.agents/mcps`).                                                                                                                         |
| `CHOL_AGENTS_PROVIDER`      | Opcional: provider padrão dos agentes (`auto`, `claude` ou `cursor`; padrão `auto`); um `--provider` na linha de comando ganha deste.                                         |
| `PLAYWRIGHT_MCP_OUTPUT_DIR` | Opcional: onde o `choliba playwright-cli` grava os arquivos que nomeia sozinho ou que recebem `--filename` relativo (snapshots, screenshots); padrão `.cache/playwright-cli`. |

## Autocomplete

O `setup` já liga o autocomplete do bash: grava o script em `~/.local/share/choliba/completion.bash` e adiciona
uma linha ao `~/.bashrc` que o carrega. Para imprimir o script sem rodar o setup, use `choliba completion bash`.

## Mantenedores

- Jackson Bicalho — [@jacksonbicalho](https://github.com/jacksonbicalho)

## Contribuindo

Perguntas, bugs e sugestões vão para as [issues](https://github.com/jacksonbicalho/choliba/issues). Pull requests são bem-vindos, sempre para a branch
`develop`, a partir de uma branch `<tipo>/<descrição>`, e seguindo as regras do projeto (detalhes em
[`AGENTS.md`](AGENTS.md) e na skill [`git-workflow`](.agents/skills/git-workflow/SKILL.md)):

- commits no [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/);
- `bun run check` verde (tipos, lint, formatação e testes) e cobertura igual ou maior que a do `develop`, o que o CI
  confere;
- nenhuma informação de agente ou LLM em commit, PR ou branch (sem `Co-authored-by`).

O `develop` só aceita merge squash; o release é um PR de `develop` para `master`, com merge commit.

### Desenvolvendo este repositório

Este repositório é, ele mesmo, uma pasta de trabalho do choliba (`choliba` está no `package.json` da raiz como
`devDependency: workspace:*`). Para testar o pacote instalável sem esperar um release, `bun run chol:pack`
builda `packages/choliba` e empacota o resultado num `.tgz` local (ignorado pelo git), que outra pasta de trabalho
instala pelo caminho do arquivo.

O release é o PR de `develop` para `master` (merge commit). O merge dispara o workflow `release-dev.yml`, que roda
o mesmo `chol:pack`, move a tag `v0.0.1-dev` para o novo commit e troca o `.tgz` e as notas da pré-release.

## Licença

[MIT](LICENSE) © 2026 Jackson Bicalho
