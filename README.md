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
  - [O texto do agente](#o-texto-do-agente)
  - [Skills e MCPs](#skills-e-mcps)
  - [Variáveis](#variáveis)
  - [Steps](#steps)
- [O que acontece numa execução](#o-que-acontece-numa-execução)
- [`--dry-run`](#--dry-run)
- [Critérios de aceite](#critérios-de-aceite)
- [Portões dos testes de um ticket](#portões-dos-testes-de-um-ticket)
- [`choliba install`](#choliba-install)
  - [O que o repositório do choliba oferece](#o-que-o-repositório-do-choliba-oferece)
  - [Exemplos](#exemplos)
    - [Skills oficiais do Playwright](#skills-oficiais-do-playwright)
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
  passo pode fazer o que o modelo não pode (o `docs-updater` proíbe o modelo de rodar o Prettier e o roda no
  `steps.execute.after`). Veja [Steps](#steps).

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
bun add --trust \
  https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

O `--trust` deixa o Bun rodar o `postinstall` do pacote, que já executa `choliba setup` (veja abaixo). Sem
`--trust`, instale e rode o setup à mão:

```
bun add \
  https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
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

- cria `app/agents/`, `app/skills/`, `app/mcps/` e `projects/` na pasta de trabalho;
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
bun add --trust \
  https://github.com/jacksonbicalho/choliba/releases/download/v0.0.1-dev/choliba-0.0.1-dev.tgz
```

## Uso

Numa pasta de trabalho com o choliba instalado, do projeto ao código implementado:

```sh
# um projeto para a aplicação em ../minha-app, e os agentes do repositório do choliba
bunx choliba projects create-project minha-app \
  --app-dir ../minha-app --base-url http://localhost:3000
bunx choliba install github:jacksonbicalho/choliba --path app/agents/product-owner
bunx choliba install github:jacksonbicalho/choliba --path app/agents/test-writer
bunx choliba install github:jacksonbicalho/choliba --path app/agents/implementer
bunx choliba check

# o ticket, os testes e a implementação
bunx choliba product-owner --project minha-app --type story "a busca aceita filtro por data"
bunx choliba test-writer --project minha-app --ticket minha-app-1
bunx choliba implementer --project minha-app --ticket minha-app-1

# os testes do ticket, a qualquer momento
bunx choliba tests minha-app:1
```

Qualquer comando de agente aceita `--dry-run`, que mostra o que ele faria, na ordem, sem executar nada (veja
[`--dry-run`](#--dry-run)).

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
(`app/agents/`), as skills (`app/skills/`) e os MCPs (`app/mcps/`) usados pelos comandos. Rodar
`choliba` de qualquer subpasta dela funciona do mesmo jeito. Essas três pastas são o padrão; `CHOL_AGENTS_DIR`,
`CHOL_SKILLS_DIR` e `CHOL_MCPS_DIR` no `.env` apontam para outras.

## Escrevendo um agente

Um agente é uma pasta `app/agents/<id>/` com um arquivo só, o `agent.yaml`. Ele declara tudo: o que o choliba lê e
aplica (identidade, modelos, skills, MCPs, permissões, modos, passos) e o texto que o modelo recebe. O choliba monta
o prompt a partir dele, e só entra no prompt o que o agente declara: uma skill ou um MCP que sai do `agent.yaml`
some do prompt junto.

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

role: |
  Você escreve os testes E2E do ticket `${TICKET}` do projeto `${PROJECT}`.
context:
  - '**Ambiente**: a URL de cada ambiente está no `config.json` do projeto.'
input: |
  - O ticket `${TICKET}`, em `${TICKET_FILE}`, com os critérios de aceite.
flow: |
  1. Leia o ticket.
  2. Escreva um teste por critério.
output: |
  O spec em `${PROJECT_DIR}/tests/${TICKET}.spec.ts`.
notes:
  - Seletores por papel e rótulo, nunca CSS.

skills:
  playwright-cli:
    instructions: |
      Onde a skill escreve `playwright-cli <comando>`, rode `bunx choliba playwright-cli <comando>`.
mcps:
  mcp-app:
    tools: [jira_get_issue]
    instructions: |
      Use quando o pedido citar uma issue do Jira (ex.: `ABC-123`).

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
  execute:
    before:
      - add_files: [ticket, '${TICKET_FILE}']
    after:
      success:
        - run: [bunx, choliba, tests, '${PROJECT}:${TICKET}']
```

| Chave                             | Obrigatória | Padrão              | O que é                                                                                                  |
| --------------------------------- | ----------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `version`                         | sim         | —                   | Versão do padrão: `1`.                                                                                   |
| `agent`                           | sim         | —                   | `id` (igual à pasta, é o nome do comando), `name`, `version` (semver do agente) e `description`.         |
| `models`                          | sim         | —                   | Modelos com que o agente pode rodar, pelo id que o provider informa.                                     |
| `role`, `input`, `flow`, `output` | sim         | —                   | O texto do agente (veja [O texto do agente](#o-texto-do-agente)).                                        |
| `context`, `notes`                | não         | nenhum              | Listas de textos que completam o texto do agente.                                                        |
| `skills`                          | não         | `[]`                | Pastas em `app/skills/`, com a instrução de uso de cada uma (veja [Skills e MCPs](#skills-e-mcps)).      |
| `mcps`                            | não         | nenhum              | Servidores em `app/mcps/<nome>.json`, com as tools liberadas e a instrução de uso de cada um.            |
| `permissions.allow`/`.deny`       | não         | nada liberado       | `read` e `write`: caminhos (terminado em `/` = tudo abaixo). `execute`: diretório → comandos.            |
| `modes.allow` / `.default`        | não         | os três / `execute` | Modos aceitos (`execute`, `plan`, `ask`) e o usado quando a linha de comando não diz.                    |
| `task.required` / `.default`      | não         | `true` / —          | Se a tarefa é obrigatória e, quando não é, qual usar (`default` passa a ser obrigatório).                |
| `ticket_types`                    | não         | agente sem ticket   | Tipos de ticket aceitos (`story`, `bug`, `improvement`, `task`); a execução pede `--type` ou `--ticket`. |
| `steps.<modo>.before` / `.after`  | não         | nenhum              | Ações do choliba antes e depois do agente, em cada modo (veja [Steps](#steps)).                          |

Regras de permissão: veja [Segurança](#segurança).

### O texto do agente

Cada campo vira uma seção do prompt, nesta ordem:

| Campo     | Seção no prompt     | Para quê                                  |
| --------- | ------------------- | ----------------------------------------- |
| `role`    | `<system_role>`     | Quem o agente é e o que faz.              |
| `context` | `<context>`         | O que ele precisa saber antes de começar. |
| `input`   | `<input_contract>`  | O que ele recebe, e as regras sobre isso. |
| `flow`    | `<execution_flow>`  | Os passos do trabalho.                    |
| `output`  | `<output_contract>` | O que ele entrega.                        |
| `notes`   | `<notes>`           | Observações.                              |

Antes dessas seções, o choliba põe no prompt o que o resto do `agent.yaml` declara: a ordem de ler cada skill (com
a instrução dela), as permissões e os servidores MCP (com a instrução de cada um). Por isso o texto do agente
**não cita** skill, MCP nem permissão. Um texto que diz "use o Jira pelo MCP `mcp-app`" continua mandando o modelo
procurar o Jira depois que o MCP sai do `agent.yaml`; a instrução de uso do Jira fica na declaração do MCP, e some
com ele.

Os textos são Markdown puro (`<comando>` é escrito assim, sem escape).

### Skills e MCPs

`skills` e `mcps` aceitam uma lista de nomes ou um mapa. No mapa, cada item pode trazer `instructions`: como este
agente usa aquela skill ou aquele servidor. A instrução entra no prompt junto com o item, e só com ele.

```yaml
skills:
  - documentation # só o nome: o agente lê o SKILL.md, sem instrução deste agente

mcps:
  mcp-app:
    tools: [jira_get_issue, jira_search] # só essas tools; sem tools, todas
    instructions: |
      Use quando o pedido citar uma issue do Jira (ex.: `ABC-123`).
  outro: null # todas as tools, sem instrução
```

No prompt, os MCPs aparecem num bloco `<mcps>`, com as tools de cada servidor e a instrução dele. Um agente sem
`mcps` não tem bloco `<mcps>`: nada no prompt cita um servidor ou uma tool.

### Variáveis

`${NOME}` num texto do `agent.yaml` é substituído pelo choliba antes de qualquer coisa rodar. O catálogo é
fechado: um nome fora da lista abaixo, ou usado onde não vale, impede o agente de carregar, com o campo onde está.

**Onde valem**: no texto do agente (`role`, `context`, `input`, `flow`, `output`, `notes`), nas `instructions` de
skills e MCPs, em `permissions` (caminhos, diretórios de `execute` e comandos) e nos argumentos das ações de
`steps`. **Onde não valem**: `agent`, `models`, `task` e as `tools` de um MCP, que são valores fixos da declaração.

#### `${CHOL_ROOT}`

A pasta de trabalho (a pasta cujo `package.json` depende do choliba). Existe sempre; o choliba a descobre sozinho, e
defini-la no `.env` ou no ambiente é erro.

```yaml
permissions:
  allow:
    execute:
      '${CHOL_ROOT}/': [bunx choliba playwright-cli] # os comandos rodam a partir da raiz
```

#### `${CHOL_AGENTS_DIR}`

A pasta dos agentes. Existe sempre: `CHOL_AGENTS_DIR` do `.env`, ou `app/agents`.

```yaml
permissions:
  deny:
    read: ['${CHOL_AGENTS_DIR}/'] # o agente não lê a definição de outros agentes
```

#### `${CHOL_SKILLS_DIR}`

A pasta das skills. Existe sempre: `CHOL_SKILLS_DIR` do `.env`, ou `app/skills`.

```yaml
permissions:
  allow:
    read: ['${CHOL_SKILLS_DIR}/playwright-cli/']
```

#### `${CHOL_MCPS_DIR}`

A pasta dos MCPs. Existe sempre: `CHOL_MCPS_DIR` do `.env`, ou `app/mcps`.

```yaml
permissions:
  deny:
    write: ['${CHOL_MCPS_DIR}/'] # o agente não altera a configuração dos MCPs
```

#### `${CHOL_GLOBAL_DIR}`

A pasta global, dos artefatos das execuções. Existe com `CHOL_GLOBAL_DIR` no `.env`.

```yaml
permissions:
  allow:
    read: ['${CHOL_GLOBAL_DIR}/shared/']
```

#### `${PROJECTS_DIR}`

A pasta de todos os projetos. Existe com `CHOL_GLOBAL_DIR` no `.env`: `PROJECTS_DIR` do `.env`, ou
`<CHOL_GLOBAL_DIR>/projects`.

```yaml
permissions:
  deny:
    read: ['${PROJECTS_DIR}/'] # nenhum projeto além do liberado por PROJECT_DIR
```

#### `${TICKET_RUNS}`

A pasta das execuções por ticket. Existe com `CHOL_GLOBAL_DIR` no `.env`, quando `TICKET_RUNS` está configurada.

```yaml
permissions:
  allow:
    read: ['${TICKET_RUNS}/${TICKET}/']
```

#### `${PROJECT}`

O nome do projeto da execução. Existe com `--project`.

```yaml
role: |
  Você é o Test Writer do projeto `${PROJECT}`.
```

#### `${PROJECT_DIR}`

A pasta do projeto. Existe com `--project`.

```yaml
permissions:
  allow:
    read: ['${PROJECT_DIR}/config.json', '${PROJECT_DIR}/tests/']
```

#### `${APP_DIR}`

O código da aplicação do ambiente ativo do projeto (`appDir` do `config.json`). Existe com `--project`.

```yaml
permissions:
  allow:
    write: ['${APP_DIR}/'] # o implementer só muda a aplicação
```

#### `${TICKET}`

A chave do ticket da execução (ex.: `TT-12`). Existe com `--type` ou `--ticket`, que exigem `ticket_types`.

```yaml
permissions:
  allow:
    write: ['${PROJECT_DIR}/tests/${TICKET}.spec.ts']
```

#### `${TICKET_FILE}`

O arquivo JSON do ticket da execução. Existe com `--type` ou `--ticket`, que exigem `ticket_types`.

```yaml
permissions:
  allow:
    write: ['${TICKET_FILE}'] # o product-owner só grava o ticket
```

#### `${AGENT_EXIT_CODE}`

O código de saída do agente. Existe só nas ações de `steps.<modo>.after`, que rodam depois dele.

```yaml
steps:
  execute:
    after:
      failure:
        - run: [bun, scripts/report-failure.ts, '${TICKET}', '${AGENT_EXIT_CODE}']
```

Consequências de usar uma variável:

- `${PROJECT}`, `${PROJECT_DIR}`, `${APP_DIR}`, `${TICKET}` ou `${TICKET_FILE}` (ou declarar `ticket_types`) tornam
  `--project` obrigatório;
- `${TICKET}` ou `${TICKET_FILE}` sem `ticket_types` impedem o agente de carregar;
- `${CHOL_GLOBAL_DIR}`, `${PROJECTS_DIR}` e `${TICKET_RUNS}` só exigem o `.env` configurado se o agente usar uma
  delas.

**Não confundir** com as variáveis dos `.json` de MCP. Um `app/mcps/<nome>.json` também usa `${NOME}`, mas
preenchido com **qualquer** variável do `.env`, sem catálogo:

```json
{
  "command": "node",
  "args": ["${MCP_APP_DIR}/dist/main.js"],
  "env": { "LOG_DIR": "${MCP_APP_LOG_DIR}" }
}
```

`MCP_APP_DIR` e `MCP_APP_LOG_DIR` vêm do `.env`; não fazem parte do catálogo do `agent.yaml`.

### Steps

`steps` são ações que **o choliba executa**, nunca o agente, declaradas **por modo** (`execute`, `plan`, `ask`).
Cada modo tem o seu `before` e o seu `after`; um modo sem `steps` não roda nada.

```yaml
steps:
  execute:
    before: # guarda: uma ação falhou → para tudo, o agente não roda
      - run: [bunx, choliba, tests, '${PROJECT}:${TICKET}', --expect, red]
    after:
      success: # o agente saiu com 0
        - run: [bunx, choliba, tests, '${PROJECT}:${TICKET}', --expect, green]
      failure: # o agente falhou: erro, limite, Ctrl+C
        - run: [bun, scripts/report-failure.ts, '${AGENT_EXIT_CODE}']
      always: # sempre, depois de success ou failure
        - run: [rm, -f, .cache/tmp.patch]
  plan:
    after: # uma lista simples é o mesmo que always
      - run: [rm, -f, .cache/tmp.patch]
```

| Ação              | Onde     | O que faz                                                          |
| ----------------- | -------- | ------------------------------------------------------------------ |
| `run`             | os dois  | Roda um comando, sem shell, a partir da pasta de trabalho.         |
| `git_diff`        | `before` | Grava o diff do working tree e põe o caminho e o índice no prompt. |
| `add_files`       | `before` | Põe o conteúdo de arquivos no prompt, dentro de uma tag (`<tag>`). |
| `record_git_head` | `after`  | Grava o commit atual, base do próximo `--since pending`.           |

O que o `before` produz entra na tarefa que o agente recebe. O `after` é um `try/catch/finally` sobre o agente:

| Bloco           | Roda quando                              |
| --------------- | ---------------------------------------- |
| `before`        | antes do agente                          |
| `after.success` | depois do agente, se ele saiu com 0      |
| `after.failure` | depois do agente, se ele falhou          |
| `after.always`  | depois de `success` ou `failure`, sempre |

Quando uma ação falha:

- **no `before`**, nada mais roda, nem o agente. O choliba termina com o código de saída do comando que falhou (1
  para uma ação que não é comando);
- **no `after`**, as ações seguintes rodam do mesmo jeito. O choliba termina com o código do agente, se ele falhou;
  senão, com o da primeira ação que falhou.

Nos dois casos a falha sai tratada no terminal: qual ação, o que ela rodou, o código e o fim da saída do comando.

```
✗ execute.before 1/2 falhou — run: bunx choliba tests tt:TT-1 --expect red (código 2)
  <as últimas linhas da saída do comando>
  O agente não foi executado.
```

**A mesma lista em vários modos.** O YAML tem âncoras: `&nome` dá um nome à lista que vem logo depois, e `*nome`
a repete em outro lugar. O `docs-updater` usa isso para que `plan` e `ask` preparem o mesmo contexto de `execute`
e limpem o diff do mesmo jeito:

```yaml
steps:
  execute:
    before: &before # a lista do before de execute ganha o nome "before"
      - git_diff: [develop, .cache/docs-updater/diff.patch, --pending, .cache/docs-updater/last-base]
    after:
      success:
        - record_git_head: [.cache/docs-updater/last-base]
      always: &cleanup # a lista do always de execute ganha o nome "cleanup"
        - run: [rm, -f, .cache/docs-updater/diff.patch]
  plan:
    before: *before # a mesma lista do before de execute
    after: *cleanup # a mesma lista do always de execute (uma lista simples é always)
```

## O que acontece numa execução

Um comando (`bunx choliba <agente> …`) passa por três fases. Nas fases 1 e 3 quem executa é o **choliba**, sem
modelo. Na fase 2 executa o **agente**: o provider (Claude Code ou Cursor) rodando o modelo, só dentro das
permissões do `agent.yaml`.

**Fase 1: o choliba, antes do agente**

1. Lê os argumentos e recusa `CHOL_ROOT` no `.env` ou no ambiente.
2. Carrega o `agent.yaml` e o valida (schema, pasta, modos, variáveis).
3. Recusa as flags que o agente não aceita; `--help` mostra a ajuda do agente e sai.
4. Valida o projeto (`--project`) e prepara o ticket (`--type` para um novo, `--ticket` para um existente).
5. Define a tarefa, o modo e o plano salvo (`--plan-from`).
6. Preenche as [variáveis](#variáveis), confere o `--model`, confere que cada skill e cada MCP existe e escolhe o
   provider.
7. Roda o `steps.<modo>.before`. Uma falha para aqui.
8. Monta os prompts: o de sistema (skills, permissões, MCPs e o texto do agente) e o do usuário (aviso do modo,
   plano salvo e a tarefa, com o que o `before` produziu).
9. Com `--dry-run`, mostra o que aconteceria e sai (veja [`--dry-run`](#--dry-run)).
10. Cria o ticket novo (`--type`).

**Fase 2: o agente**

11. O provider roda numa pasta vazia, `.cache/runs/<id>/`, com os dois prompts. O agente lê, grava, roda os
    comandos de `allow.execute` e chama as tools dos MCPs; em `plan` e `ask`, não grava nada.

**Fase 3: o choliba, depois do agente**

12. Apaga a pasta da execução e desfaz o que o provider preparou (os arquivos `.cursor/` do Cursor), seja qual for
    o resultado.
13. Roda o `steps.<modo>.after`: `success` ou `failure`, depois `always`.
14. Fecha o ticket: um ticket novo que o agente não tocou é apagado; em `execute`, sobrar `CHANGE_ME` é erro.

O que cada agente do repositório faz em cada fase, em `execute`:

| Agente          | Fase 1 (`before`)                                                            | Fase 2 (agente)                                                | Fase 3 (`after`)                                                     |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `product-owner` | nada; com `--type`, o choliba cria o ticket                                  | usa a aplicação no navegador, consulta o Jira e grava o ticket | nada; o choliba fecha o ticket                                       |
| `test-writer`   | nada                                                                         | grava `tests/<ticket>.spec.ts` e roda os testes do ticket      | `success`: `tests --expect red`, que grava o resumo das falhas       |
| `implementer`   | `tests --expect red` (há o que implementar?) e o resumo das falhas no prompt | muda só `APP_DIR` e roda os testes                             | `success`: `tests --expect green` e os testes do projeto             |
| `docs-updater`  | o diff (`git_diff`), a documentação e o README no prompt                     | grava só `docs/` e o `README.md`                               | `success`: Prettier e a base do próximo diff; `always`: apaga o diff |

## `--dry-run`

`--dry-run` mostra, na ordem, o que o comando faria sem ele, e **não executa nada**: nenhum step, nenhum ticket,
nenhuma pasta de execução, nenhum provider. Vale em qualquer modo. Ele só lê o que precisa para montar a lista (o
`agent.yaml`, as skills, os MCPs, o projeto e o ticket), então um problema que faria a execução falhar antes do
agente aparece do mesmo jeito.

```
$ bunx choliba docs-updater --mode plan --dry-run
Sem --dry-run, faria nesta ordem:

 1. [CLI]    plan.before 1/3 — git_diff: develop .cache/docs-updater/diff.patch --pending …
             se falhar: para aqui, o agente não roda
 2. [CLI]    plan.before 2/3 — add_files: documentacao_atual docs/**/*.md
             se falhar: para aqui, o agente não roda
 3. [CLI]    plan.before 3/3 — add_files: readme_atual README.md
             se falhar: para aqui, o agente não roda
 4. [agente] claude · modelo padrão do provider · modo plan · na pasta .cache/runs/<id>
             skills: documentation · MCPs: nenhum
             prompt de sistema: 5953 bytes · prompt do usuário: 444 bytes (--show-prompt mostra os dois)
             comando: claude -p <prompt do usuário> --output-format stream-json --verbose …
 5. [CLI]    plan.after.success (se o agente sair com 0): nada
             plan.after.failure (se o agente falhar): nada
             plan.after.always:
               1/1 run: rm -f .cache/docs-updater/diff.patch
```

Com `--show-prompt` (só junto de `--dry-run`), a saída segue com os dois prompts completos, a linha de comando
completa (em JSON, um argumento por item) e, no Cursor, os arquivos `.cursor/cli.json` e `.cursor/mcp.json` como
seriam gravados.

## Critérios de aceite

Cada critério do ticket (`criterios[]`) tem um `id` (`CA-01`, `CA-02`…) e uma `descricao` em Gherkin: uma lista de
frases, uma por passo. A primeira começa com `Dado`, depois vêm um `Quando` e um `Então`, nessa ordem; `E` e `Mas`
continuam qualquer um deles:

```json
{
  "id": "CA-01",
  "descricao": ["Dado que estou na página da loja", "E ainda não assinei a newsletter", "Quando informo meu e-mail e clico em Assinar", "Então vejo a mensagem \"Obrigado por assinar!\"", "Mas não recebo nenhum aviso de erro"],
  "testes": []
}
```

Não existe `Ou`: um resultado com "ou" são dois comportamentos, e cada um vira um critério. Uma execução que deixa um
critério fora desse formato (ou com `CHANGE_ME`) falha, dizendo qual frase corrigir.

## Portões dos testes de um ticket

`choliba tests PROJECT:TICKET --expect red|green [--failures ARQUIVO]` roda os testes de um ticket e confere o que
eles mostram. É assim que os agentes `test-writer` e `implementer` garantem o TDD:

- **`--expect red`**: todo critério do ticket tem teste, nenhum quebra no próprio código nem é pulado, e **pelo
  menos um falha pelo comportamento** (há o que implementar). Um critério cujos testes já passam fica como **já
  atendido**: o teste continua valendo como proteção contra regressão. Se todos passam, o portão recusa (nada a
  implementar).
- **`--expect green`**: todos os testes do ticket passam, inclusive os dos critérios já atendidos.
- **`--failures ARQUIVO`**: grava, em Markdown, os critérios a implementar com a falha de cada teste e, por último,
  os já atendidos. O `test-writer` grava esse arquivo no seu `steps.execute.after.success`, e o `implementer` o
  confere e o põe no prompt no seu `steps.<modo>.before` (veja [O que acontece numa execução](#o-que-acontece-numa-execução)).

## `choliba install`

Traz um agente (com as skills e os MCPs que ele declara), uma skill ou um MCP para a pasta de trabalho,
substituindo o que já estiver no destino:

```
choliba install <origem> [--path <item na origem>] [--dry-run]
```

- `<origem>` é uma pasta local, um repositório git (`https://…`, `git@…`, `github:dono/repo[#ref]`, ...) ou um
  pacote npm (nome ou `nome@versão`).
- `--path` escolhe o item dentro da origem (ex.: `--path app/agents/test-writer`), para origens com mais de um agente,
  skill ou MCP. Sem `--path`, a origem já precisa ser o item: uma pasta com `agent.yaml` ou `SKILL.md`, ou um
  arquivo `.json`.
- `--dry-run` mostra o que seria instalado, sem gravar nada.

Instalar um agente também traz as skills e os MCPs que ele declara, quando estão na origem; os que faltam saem
como aviso, para instalar à parte. Se o `.json` de um MCP usa uma variável (`${NOME}`) sem valor no `.env`, isso
também aparece como aviso.

### O que o repositório do choliba oferece

| Tipo   | Caminho na origem                         | Para quê                                                                            |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| agente | `app/agents/product-owner`                | Escreve o ticket com critérios de aceite, usando a aplicação no navegador.          |
| agente | `app/agents/test-writer`                  | Escreve um teste por critério, antes da implementação.                              |
| agente | `app/agents/implementer`                  | Muda a aplicação até os testes do ticket passarem.                                  |
| agente | `app/agents/docs-updater`                 | Atualiza a documentação a partir do diff.                                           |
| skill  | `app/skills/playwright-cli`               | Ensina o agente a usar o navegador (`choliba playwright-cli`).                      |
| skill  | `app/skills/playwright-trace`             | Ensina o agente a ler o `trace.zip` de um teste que falhou.                         |
| skill  | `app/skills/playwright-component-testing` | Testes de componente com Playwright.                                                |
| skill  | `app/skills/documentation`                | Boas práticas de documentação (usada pelo `docs-updater`).                          |
| MCP    | `app/mcps/mcp-app.json`                   | O servidor [mcp-app](https://github.com/jacksonbicalho/mcp-app) (Jira e ambientes). |

As três skills `playwright-*` são cópias das skills oficiais do Playwright, na versão do `@playwright/test` que o
choliba usa (1.63.0). Para instalá-las direto da fonte oficial, veja
[Skills oficiais do Playwright](#skills-oficiais-do-playwright).

### Exemplos

As saídas abaixo são de execuções reais, numa pasta de trabalho recém-criada com `bun add --trust` (veja
[Instalação](#instalação)).

#### Os agentes do choliba

Cada agente traz as skills e os MCPs que declara, do mesmo repositório:

```
$ bunx choliba install github:jacksonbicalho/choliba --path app/agents/product-owner
Instalado:
  agente product-owner → app/agents/product-owner
  skill playwright-cli → app/skills/playwright-cli
  MCP mcp-app → app/mcps/mcp-app.json

Avisos:
  - o MCP mcp-app usa ${MCP_APP_DIR}, ${MCP_APP_LOG_DIR}, sem valor no .env: defina antes de rodar o agente.

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path app/agents/test-writer
Instalado:
  agente test-writer → app/agents/test-writer
  skill playwright-cli → app/skills/playwright-cli
  skill playwright-trace → app/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path app/agents/implementer
Instalado:
  agente implementer → app/agents/implementer
  skill playwright-trace → app/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path app/agents/docs-updater
Instalado:
  agente docs-updater → app/agents/docs-updater
  skill documentation → app/skills/documentation

Confira com: choliba check
```

#### Uma skill ou um MCP sozinho

```
$ bunx choliba install github:jacksonbicalho/choliba --path app/skills/playwright-trace
Instalado:
  skill playwright-trace → app/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path app/mcps/mcp-app.json
Instalado:
  MCP mcp-app → app/mcps/mcp-app.json

Avisos:
  - o MCP mcp-app usa ${MCP_APP_DIR}, ${MCP_APP_LOG_DIR}, sem valor no .env: defina antes de rodar o agente.

Confira com: choliba check
```

#### O servidor do MCP `mcp-app`

O `mcp-app.json` só diz como iniciar o servidor: `node ${MCP_APP_DIR}/dist/main.js`. O servidor é outro
repositório, [jacksonbicalho/mcp-app](https://github.com/jacksonbicalho/mcp-app), que você clona e compila uma vez
(os passos são os do README dele):

```sh
git clone https://github.com/jacksonbicalho/mcp-app ~/mcp-app
cd ~/mcp-app
yarn install
yarn build
```

A configuração do Jira e dos ambientes (`.env` e `environments.json` do próprio mcp-app) está no
[README do mcp-app](https://github.com/jacksonbicalho/mcp-app#configura%C3%A7%C3%A3o). Na pasta de trabalho do
choliba, o `.env` diz onde ele está:

```sh
# .env da pasta de trabalho
MCP_APP_DIR=/home/voce/mcp-app
MCP_APP_LOG_DIR=/home/voce/mcp-app/logs
```

Sem essas duas variáveis, o `check` marca o `product-owner` com `✗` e diz que o `mcp-app.json` usa
`${MCP_APP_DIR}` e `${MCP_APP_LOG_DIR}` sem valor. Com elas, tudo carrega:

```
$ bunx choliba check
Agentes (<pasta de trabalho>/app/agents)
  ✓ docs-updater
  ✓ implementer
  ✓ product-owner
  ✓ test-writer

Projetos (<pasta de trabalho>/projects)
  ✓ exemplo
```

#### Skills oficiais do Playwright

As skills oficiais estão em dois lugares, e o `install` aceita os dois:

| Fonte                                                                               | `--path`                   |
| ----------------------------------------------------------------------------------- | -------------------------- |
| repositório [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) | `skills/playwright-cli`    |
| pacote npm `@playwright/cli`, do mesmo repositório                                  | `skills/playwright-cli`    |
| pacote npm `playwright-core@<versão>`                                               | `lib/tools/skills/<skill>` |

O `playwright-core` traz as três (`playwright-cli`, `playwright-trace` e `playwright-component-testing`). Fixe a
versão igual à do Playwright da pasta de trabalho (`bunx playwright --version`), para a skill descrever os comandos
que você tem.

```
$ bunx choliba install github:microsoft/playwright-cli --path skills/playwright-cli
Instalado:
  skill playwright-cli → app/skills/playwright-cli

Confira com: choliba check
```

```
$ bunx choliba install playwright-core@1.63.0 --path lib/tools/skills/playwright-trace
Instalado:
  skill playwright-trace → app/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install @playwright/cli --path skills/playwright-cli --dry-run
Instalaria (--dry-run, nada foi gravado):
  skill playwright-cli → app/skills/playwright-cli

Confira com: choliba check
```

Nessas origens o `--path` é obrigatório, porque a origem não é o item. Sem ele, o `install` lista os itens que
encontra numa origem organizada como uma pasta de trabalho (`app/agents/`, `app/skills/`, `app/mcps/`) ou com essas
pastas na raiz (`agents/`, `skills/`, `mcps/`); fora disso, não lista nada.

O texto das skills oficiais usa `playwright-cli` e `npx playwright trace`. Os agentes do choliba traduzem isso na
instrução de cada skill no `agent.yaml` (`bunx choliba playwright-cli`, `bunx choliba playwright-trace`), que roda a
versão do Playwright do choliba (veja [Skills e MCPs](#skills-e-mcps)).

#### Outras origens

Uma branch ou tag, um clone local, ou só para ver o que seria instalado (`--dry-run`):

```
$ bunx choliba install github:jacksonbicalho/choliba#develop --path app/agents/test-writer --dry-run
Instalaria (--dry-run, nada foi gravado):
  agente test-writer → app/agents/test-writer
  skill playwright-cli → app/skills/playwright-cli
  skill playwright-trace → app/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install ../choliba --path app/agents/implementer --dry-run
Instalaria (--dry-run, nada foi gravado):
  agente implementer → app/agents/implementer
  skill playwright-trace → app/skills/playwright-trace

Confira com: choliba check
```

## `.env` da pasta de trabalho

Quais destes valores o `agent.yaml` pode usar, e como: veja [Variáveis](#variáveis).

| Variável                    | Para quê                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHOL_GLOBAL_DIR`           | Raiz dos artefatos das execuções e, sem `PROJECTS_DIR`, dos projetos (`CHOL_GLOBAL_DIR/projects`). Preenchida pelo `setup` com `.cache/choliba` da pasta de trabalho.         |
| `PROJECTS_DIR`              | Onde ficam os projetos, se não em `CHOL_GLOBAL_DIR/projects`. Preenchida pelo `setup` com `projects/` da pasta de trabalho.                                                   |
| `TICKET_RUNS`               | Opcional: raiz de `ticket-runs/`, se não for `PROJECTS_DIR`.                                                                                                                  |
| `CHOL_AGENTS_DIR`           | Opcional: pasta dos agentes (padrão `app/agents`).                                                                                                                            |
| `CHOL_SKILLS_DIR`           | Opcional: pasta das skills (padrão `app/skills`).                                                                                                                             |
| `CHOL_MCPS_DIR`             | Opcional: pasta dos MCPs (padrão `app/mcps`).                                                                                                                                 |
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
