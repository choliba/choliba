# Instalar agentes, skills e MCPs

> Como trazer para a pasta de trabalho um agente, com as skills e os MCPs que ele declara, uma skill ou um MCP.

Traz um agente (com as skills e os MCPs que ele declara), uma skill ou um MCP para a pasta de trabalho,
substituindo o que já estiver no destino:

```
bunx choliba add <origem> [--path <item na origem>] [--dry-run]
```

- `<origem>` é uma pasta local, um repositório git (`https://…`, `git@…`, `github:dono/repo[#ref]`, ...) ou um
  pacote npm (nome ou `nome@versão`).
- `--path` escolhe o item dentro da origem (ex.: `--path .agents/agents/test-writer`), para origens com mais de um agente,
  skill ou MCP. Sem `--path`, a origem já precisa ser o item: uma pasta com `agent.yaml` ou `SKILL.md`, ou um
  arquivo `.json`.
- `--dry-run` mostra o que seria instalado, sem gravar nada.

Instalar um agente também traz as skills e os MCPs que ele declara, quando estão na origem; os que faltam saem
como aviso, para instalar à parte. Se o `.json` de um MCP usa uma variável (`${NOME}`) sem valor no `.env`, isso
também aparece como aviso.

## O que o repositório do choliba oferece

| Tipo   | Caminho na origem                             | Para quê                                                                   |
| ------ | --------------------------------------------- | -------------------------------------------------------------------------- |
| agente | `.agents/agents/product-owner`                | Escreve o ticket com critérios de aceite, usando a aplicação no navegador. |
| agente | `.agents/agents/test-writer`                  | Escreve um teste por critério, antes da implementação.                     |
| agente | `.agents/agents/implementer`                  | Muda a aplicação até os testes do ticket passarem.                         |
| agente | `.agents/agents/docs-updater`                 | Atualiza a documentação a partir do diff.                                  |
| skill  | `.agents/skills/playwright-cli`               | Ensina o agente a usar o navegador (a ferramenta da run `playwright-cli`). |
| skill  | `.agents/skills/playwright-trace`             | Ensina o agente a ler o `trace.zip` de um teste que falhou.                |
| skill  | `.agents/skills/playwright-component-testing` | Testes de componente com Playwright.                                       |
| skill  | `.agents/skills/documentation`                | Boas práticas de documentação (usada pelo `docs-updater`).                 |

As três skills `playwright-*` são cópias das skills oficiais do Playwright, na versão do `@playwright/test` que o
choliba usa (1.63.0). Para instalá-las direto da fonte oficial, veja
[Skills oficiais do Playwright](#skills-oficiais-do-playwright).

## Exemplos

As saídas abaixo são de execuções reais, numa pasta de trabalho recém-criada com `bun add --trust` (veja
[Instalação](../primeiros-passos.md)).

### Os agentes do choliba

Cada agente traz as skills e os MCPs que declara, do mesmo repositório:

```
$ bunx choliba add github:choliba/choliba --path .agents/agents/product-owner
Instalado:
  agente product-owner → .choliba/agents/product-owner
  skill playwright-cli → .choliba/skills/playwright-cli

Confira com: bunx choliba check
```

```
$ bunx choliba add github:choliba/choliba --path .agents/agents/test-writer
Instalado:
  agente test-writer → .choliba/agents/test-writer
  skill playwright-cli → .choliba/skills/playwright-cli
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: bunx choliba check
```

```
$ bunx choliba add github:choliba/choliba --path .agents/agents/implementer
Instalado:
  agente implementer → .choliba/agents/implementer
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: bunx choliba check
```

```
$ bunx choliba add github:choliba/choliba --path .agents/agents/docs-updater
Instalado:
  agente docs-updater → .choliba/agents/docs-updater
  skill documentation → .choliba/skills/documentation

Confira com: bunx choliba check
```

### Uma skill ou um MCP sozinho

```
$ bunx choliba add github:choliba/choliba --path .agents/skills/playwright-trace
Instalado:
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: bunx choliba check
```

### Skills oficiais do Playwright

As skills oficiais estão em dois lugares, e o `add` aceita os dois:

| Fonte                                                                               | `--path`                   |
| ----------------------------------------------------------------------------------- | -------------------------- |
| repositório [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) | `skills/playwright-cli`    |
| pacote npm `@playwright/cli`, do mesmo repositório                                  | `skills/playwright-cli`    |
| pacote npm `playwright-core@<versão>`                                               | `lib/tools/skills/<skill>` |

O `playwright-core` traz as três (`playwright-cli`, `playwright-trace` e `playwright-component-testing`). Fixe a
versão igual à do Playwright da pasta de trabalho (`bunx playwright --version`), para a skill descrever os comandos
que você tem.

```
$ bunx choliba add github:microsoft/playwright-cli --path skills/playwright-cli
Instalado:
  skill playwright-cli → .choliba/skills/playwright-cli

Confira com: bunx choliba check
```

```
$ bunx choliba add playwright-core@1.63.0 --path lib/tools/skills/playwright-trace
Instalado:
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: bunx choliba check
```

```
$ bunx choliba add @playwright/cli --path skills/playwright-cli --dry-run
Instalaria (--dry-run, nada foi gravado):
  skill playwright-cli → .choliba/skills/playwright-cli

Confira com: bunx choliba check
```

Nessas origens o `--path` é obrigatório, porque a origem não é o item. Sem ele, o `add` lista os itens que
encontra numa origem organizada como uma pasta de trabalho (`.choliba/agents/`, `.choliba/skills/`, `.choliba/mcps/`) ou com essas
pastas na raiz (`agents/`, `skills/`, `mcps/`); fora disso, não lista nada.

O texto das skills oficiais usa `playwright-cli` e `npx playwright trace`. Os agentes do choliba traduzem isso na
instrução de cada skill no `agent.yaml`: as ferramentas da run `playwright-cli` e `playwright-trace`, que rodam a
versão do Playwright do choliba (veja [Ferramentas da run](../referencia/agent-yaml.md#ferramentas-da-run)).

### Outras origens

Uma branch ou tag, um clone local, ou só para ver o que seria instalado (`--dry-run`):

```
$ bunx choliba add github:choliba/choliba#develop --path .agents/agents/test-writer --dry-run
Instalaria (--dry-run, nada foi gravado):
  agente test-writer → .choliba/agents/test-writer
  skill playwright-cli → .choliba/skills/playwright-cli
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: bunx choliba check
```

```
$ bunx choliba add ../choliba --path .agents/agents/implementer --dry-run
Instalaria (--dry-run, nada foi gravado):
  agente implementer → .choliba/agents/implementer
  skill playwright-trace → .choliba/skills/playwright-trace

Confira com: bunx choliba check
```
