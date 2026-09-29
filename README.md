# choliba

Testes E2E multiprojeto com Playwright, operados por agentes.

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

Para pegar a versão mais nova depois de um merge na `master`, rode o mesmo `bun add` de novo.

## A pasta de trabalho

`choliba` roda sempre numa **pasta de trabalho**: a pasta, subindo a partir de onde o comando é chamado, cujo
`package.json` depende de `choliba` (é o que `bun add choliba` cria). É nela que ficam o `.env`, os agentes
(`app/agents/`), as skills (`app/.agents/skills/`) e os MCPs (`app/.agents/mcps/`) usados pelos comandos. Rodar
`choliba` de qualquer subpasta dela funciona do mesmo jeito. Essas três pastas são o padrão; `CHOL_AGENTS_DIR`,
`CHOL_SKILLS_DIR` e `CHOL_MCPS_DIR` no `.env` apontam para outras.

## `choliba setup`

Roda sozinho no `postinstall` (com `--trust`) ou à mão (`bunx choliba setup`). Sem sobrescrever o que já existe,
ele:

- cria `app/agents/`, `app/.agents/skills/`, `app/.agents/mcps/` e `projects/` na pasta de trabalho;
- copia de um template `.env.example`, `.gitignore`, `.editorconfig` (largura e indentação, que o Prettier lê) e os
  arquivos do Prettier e do ESLint, e cria o `.env` inicial com `CHOL_GLOBAL_DIR` apontando para
  `.cache/choliba` e `PROJECTS_DIR` para `projects/`, os dois da própria pasta de trabalho;
- lista `choliba` em `trustedDependencies` do `package.json`, para que instalações futuras rodem o setup de novo
  sem pedir `--trust`;
- liga o autocomplete do bash (veja abaixo).

## Comandos

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
| `ticket_types`               | não         | agente sem ticket   | Tipos de ticket aceitos (`epic`, `story`, `bug`, `improvement`, `task`); a execução pede `--type` ou `--ticket`.                    |
| `steps.before` / `.after`    | não         | nenhum              | Ações do choliba antes do modelo (`run`, `git_diff`, `add_files`) e depois de um `execute` bem-sucedido (`run`, `record_git_head`). |

Regras que valem para qualquer agente:

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
- **Variáveis.** Caminhos, comandos e argumentos de passos aceitam `${CHOL_ROOT}` (a pasta de trabalho, sempre
  encontrada pelo choliba: definir `CHOL_ROOT` no `.env` ou no ambiente é erro), `${CHOL_AGENTS_DIR}`,
  `${CHOL_SKILLS_DIR}`, `${CHOL_MCPS_DIR}`, `${CHOL_GLOBAL_DIR}`, `${PROJECTS_DIR}`, `${PROJECT}`, `${PROJECT_DIR}`, `${APP_DIR}`, `${TICKET}` e
  `${TICKET_FILE}`. Uma variável sem valor interrompe a execução.
- **Projeto.** Um agente que usa uma variável de projeto (`${PROJECT}`, `${PROJECT_DIR}`, `${APP_DIR}`,
  `${TICKET}`, `${TICKET_FILE}`) no `agent.yaml` ou no `system.md`, ou declara `ticket_types`, exige `--project`.

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

## Desenvolvendo este repositório

Este repositório é, ele mesmo, uma pasta de trabalho do choliba (`choliba` está no `package.json` da raiz como
`devDependency: workspace:*`). Para testar o pacote instalável sem esperar um release, `bun run chol:pack`
builda `packages/choliba` e empacota o resultado num `.tgz` local (ignorado pelo git), que outra pasta de trabalho
instala pelo caminho do arquivo.

O release é o PR de `develop` para `master` (merge commit). O merge dispara o workflow `release-dev.yml`, que roda
o mesmo `chol:pack`, move a tag `v0.0.1-dev` para o novo commit e troca o `.tgz` e as notas da pré-release.
