# `choliba install`

Traz um agente (com as skills e os MCPs que ele declara), uma skill ou um MCP para a pasta de trabalho,
substituindo o que já estiver no destino:

```
choliba install <origem> [--path <item na origem>] [--dry-run]
```

- `<origem>` é uma pasta local, um repositório git (`https://…`, `git@…`, `github:dono/repo[#ref]`, ...) ou um
  pacote npm (nome ou `nome@versão`).
- `--path` escolhe o item dentro da origem (ex.: `--path .choliba/agents/test-writer`), para origens com mais de um agente,
  skill ou MCP. Sem `--path`, a origem já precisa ser o item: uma pasta com `agent.yaml` ou `SKILL.md`, ou um
  arquivo `.json`.
- `--dry-run` mostra o que seria instalado, sem gravar nada.

Instalar um agente também traz as skills e os MCPs que ele declara, quando estão na origem; os que faltam saem
como aviso, para instalar à parte. Se o `.json` de um MCP usa uma variável (`${NOME}`) sem valor no `.env`, isso
também aparece como aviso.

## O que o repositório do choliba oferece

| Tipo   | Caminho na origem                              | Para quê                                                                            |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| agente | `.choliba/agents/product-owner`                | Escreve o ticket com critérios de aceite, usando a aplicação no navegador.          |
| agente | `.choliba/agents/test-writer`                  | Escreve um teste por critério, antes da implementação.                              |
| agente | `.choliba/agents/implementer`                  | Muda a aplicação até os testes do ticket passarem.                                  |
| agente | `.choliba/agents/docs-updater`                 | Atualiza a documentação a partir do diff.                                           |
| skill  | `.choliba/skills/playwright-cli`               | Ensina o agente a usar o navegador (`choliba playwright-cli`).                      |
| skill  | `.choliba/skills/playwright-trace`             | Ensina o agente a ler o `trace.zip` de um teste que falhou.                         |
| skill  | `.choliba/skills/playwright-component-testing` | Testes de componente com Playwright.                                                |
| skill  | `.choliba/skills/documentation`                | Boas práticas de documentação (usada pelo `docs-updater`).                          |
| MCP    | `.choliba/mcps/mcp-app.json`                   | O servidor [mcp-app](https://github.com/jacksonbicalho/mcp-app) (Jira e ambientes). |

As três skills `playwright-*` são cópias das skills oficiais do Playwright, na versão do `@playwright/test` que o
choliba usa (1.63.0). Para instalá-las direto da fonte oficial, veja
[Skills oficiais do Playwright](#skills-oficiais-do-playwright).

## Exemplos

As saídas abaixo são de execuções reais, numa pasta de trabalho recém-criada com `bun add --trust` (veja
[Instalação](../primeiros-passos.md)).

### Os agentes do choliba

Cada agente traz as skills e os MCPs que declara, do mesmo repositório:

```
$ bunx choliba install github:jacksonbicalho/choliba --path .choliba/agents/product-owner
Instalado:
  agente product-owner → .choliba/agents/product-owner
  skill playwright-cli → .choliba/skills/playwright-cli
  MCP mcp-app → .choliba/mcps/mcp-app.json

Avisos:
  - o MCP mcp-app usa ${CHOL_MCP_APP_DIR}, ${CHOL_MCP_APP_LOG_DIR}, sem valor no .env: defina antes de rodar o agente.

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path .choliba/agents/test-writer
Instalado:
  agente test-writer → .choliba/agents/test-writer
  skill playwright-cli → .choliba/skills/playwright-cli
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path .choliba/agents/implementer
Instalado:
  agente implementer → .choliba/agents/implementer
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path .choliba/agents/docs-updater
Instalado:
  agente docs-updater → .choliba/agents/docs-updater
  skill documentation → .choliba/skills/documentation

Confira com: choliba check
```

### Uma skill ou um MCP sozinho

```
$ bunx choliba install github:jacksonbicalho/choliba --path .choliba/skills/playwright-trace
Instalado:
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install github:jacksonbicalho/choliba --path .choliba/mcps/mcp-app.json
Instalado:
  MCP mcp-app → .choliba/mcps/mcp-app.json

Avisos:
  - o MCP mcp-app usa ${CHOL_MCP_APP_DIR}, ${CHOL_MCP_APP_LOG_DIR}, sem valor no .env: defina antes de rodar o agente.

Confira com: choliba check
```

### O servidor do MCP `mcp-app`

O `mcp-app.json` só diz como iniciar o servidor: `node ${CHOL_MCP_APP_DIR}/dist/main.js`. O servidor é outro
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
CHOL_MCP_APP_DIR=/home/voce/mcp-app
CHOL_MCP_APP_LOG_DIR=/home/voce/mcp-app/logs
```

Sem essas duas variáveis, o `check` marca o `product-owner` com `✗` e diz que o `mcp-app.json` usa
`${CHOL_MCP_APP_DIR}` e `${CHOL_MCP_APP_LOG_DIR}` sem valor. Com elas, tudo carrega:

```
$ bunx choliba check
Agentes (<pasta de trabalho>/.choliba/agents)
  ✓ docs-updater
  ✓ implementer
  ✓ product-owner
  ✓ test-writer

Projetos (<pasta de trabalho>/projects)
  ✓ exemplo
```

### Skills oficiais do Playwright

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
  skill playwright-cli → .choliba/skills/playwright-cli

Confira com: choliba check
```

```
$ bunx choliba install playwright-core@1.63.0 --path lib/tools/skills/playwright-trace
Instalado:
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install @playwright/cli --path skills/playwright-cli --dry-run
Instalaria (--dry-run, nada foi gravado):
  skill playwright-cli → .choliba/skills/playwright-cli

Confira com: choliba check
```

Nessas origens o `--path` é obrigatório, porque a origem não é o item. Sem ele, o `install` lista os itens que
encontra numa origem organizada como uma pasta de trabalho (`.choliba/agents/`, `.choliba/skills/`, `.choliba/mcps/`) ou com essas
pastas na raiz (`agents/`, `skills/`, `mcps/`); fora disso, não lista nada.

O texto das skills oficiais usa `playwright-cli` e `npx playwright trace`. Os agentes do choliba traduzem isso na
instrução de cada skill no `agent.yaml` (`bunx choliba playwright-cli`, `bunx choliba playwright-trace`), que roda a
versão do Playwright do choliba (veja [Skills e MCPs](escrever-um-agente.md#skills-e-mcps)).

### Outras origens

Uma branch ou tag, um clone local, ou só para ver o que seria instalado (`--dry-run`):

```
$ bunx choliba install github:jacksonbicalho/choliba#develop --path .choliba/agents/test-writer --dry-run
Instalaria (--dry-run, nada foi gravado):
  agente test-writer → .choliba/agents/test-writer
  skill playwright-cli → .choliba/skills/playwright-cli
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: choliba check
```

```
$ bunx choliba install ../choliba --path .choliba/agents/implementer --dry-run
Instalaria (--dry-run, nada foi gravado):
  agente implementer → .choliba/agents/implementer
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: choliba check
```
