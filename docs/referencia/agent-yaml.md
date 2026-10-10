# O `agent.yaml`

> Todas as chaves do `agent.yaml`, as variáveis `${NOME}` que ele aceita e as ações de `steps`, com o schema que
> valida o arquivo.

Todas as chaves do `agent.yaml` (padrão 1), as variáveis `${NOME}` que ele aceita e as ações de `steps`. Um exemplo
completo e o passo a passo estão em [Escrevendo um agente](../guias/escrever-um-agente.md); o schema é
`packages/agents/schemes/v1/agent.schema.json`.

| Chave                             | Obrigatória | Padrão              | O que é                                                                                                                                                                                                                                                                                         |
| --------------------------------- | ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`                         | sim         | —                   | Versão do padrão: `1`.                                                                                                                                                                                                                                                                          |
| `agent`                           | sim         | —                   | `id` (igual à pasta, é o nome do comando), `name`, `version` (semver do agente), `description` e, opcional, `color` (cor do rótulo `[agente]`; `CHOL_COLORS` ganha dela).                                                                                                                       |
| `models`                          | sim         | —                   | Modelos com que o agente pode rodar, pelo id que o provider informa.                                                                                                                                                                                                                            |
| `role`, `input`, `flow`, `output` | sim         | —                   | O texto do agente (veja [O texto do agente](../guias/escrever-um-agente.md#o-texto-do-agente)).                                                                                                                                                                                                 |
| `context`, `notes`                | não         | nenhum              | Listas de textos que completam o texto do agente.                                                                                                                                                                                                                                               |
| `skills`                          | não         | `[]`                | Pastas em `.choliba/skills/`, com a instrução de uso de cada uma (veja [Skills e MCPs](../guias/escrever-um-agente.md#skills-e-mcps)).                                                                                                                                                          |
| `mcps`                            | não         | nenhum              | Servidores em `.choliba/mcps/<nome>.json`, com as tools liberadas e a instrução de uso de cada um. Usar outro MCP interrompe a execução.                                                                                                                                                        |
| `permissions.allow`/`.deny`       | não         | nada liberado       | `read`, `write` e `delete`: caminhos (sem glob = o item e tudo abaixo; em `deny`, `!caminho` é uma exceção). `execute`: diretório → comandos. `tools`: ferramenta da run → subcomandos (`['*']` = todos; em `deny`, `['*']` tira a ferramenta). Veja [Ferramentas da run](#ferramentas-da-run). |
| `modes.allow` / `.default`        | não         | os três / `execute` | Modos aceitos (`execute`, `plan`, `ask`) e o usado quando a linha de comando não diz.                                                                                                                                                                                                           |
| `task.required` / `.default`      | não         | `true` / —          | Se a tarefa é obrigatória e, quando não é, qual usar (`default` passa a ser obrigatório).                                                                                                                                                                                                       |
| `ticket_types`                    | não         | agente sem ticket   | Tipos de ticket aceitos (`story`, `bug`, `improvement`, `task`); a execução pede `--type` ou `--ticket`, a não ser com `allow_without_ticket`.                                                                                                                                                  |
| `allow_without_ticket`            | não         | `false`             | `true` deixa a execução seguir sem `--type`/`--ticket`: com `ticket_types`, o ticket fica opcional; sem, deixa explícito que o agente não usa ticket.                                                                                                                                           |
| `steps.<modo>.before` / `.after`  | não         | nenhum              | Ações do choliba antes e depois do agente, em cada modo (veja [Steps](#steps)).                                                                                                                                                                                                                 |

Regras de permissão: veja [Segurança](../conceitos/seguranca.md). Delegar a um subagente não é uma permissão: é
negado a todo agente, sem chave no `agent.yaml`.

### Exceções no deny

Em `deny.read`, `deny.write` e `deny.delete`, um caminho que começa com `!` tira esse caminho de um deny da mesma
lista, como no `.gitignore`. A exceção não libera nada sozinha: o que está nela ainda precisa estar em `allow`.

```yaml
permissions:
  allow:
    read: ['/home/jackson/dev/teste/', '${CHOL_ROOT}/docs/publico/']
  deny:
    read: ['${CHOL_ROOT}/', '!${CHOL_ROOT}/docs/publico/']
```

O agente lê o app em `/home/jackson/dev/teste/` e, da pasta de trabalho, só `docs/publico/`. A pasta de cada skill
que o agente declara já é uma exceção sozinha: ela não precisa de `!`. Uma exceção que não está dentro de nenhum
deny da lista (ou que fica dentro de um glob) para a execução antes do provider, porque não tira nada.

## Ferramentas da run

O que só os agentes usam não é comando do choliba: é uma ferramenta da run. Em cada execução, o choliba cria o script
de cada ferramenta ao lado da pasta da run (`.cache/runs/<execução>.<ferramenta>`), libera só esse caminho para o
agente, impede que ele seja reescrito e o apaga no fim. O prompt traz o caminho completo de cada uma.

| Ferramenta         | Vem de                     | O que faz                                                                                                                                                       |
| ------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delete`           | `permissions.allow.delete` | Apaga arquivos e pastas sob esses caminhos; recusa links para fora, a própria raiz e o que `deny.delete` nega. Não existe em `plan`/`ask`.                      |
| `playwright-cli`   | `permissions.allow.tools`  | O navegador (`playwright cli`), na versão do choliba, na raiz da pasta de trabalho; grava em `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR`.                                  |
| `playwright-trace` | `permissions.allow.tools`  | Lê o `trace.zip` de um teste que falhou (`playwright trace`), na versão do choliba; roda em `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR`, com os caminhos relativos à raiz. |

```yaml
permissions:
  allow:
    delete: ['${APP_DIR}/']
    tools:
      playwright-cli: ['*']
      playwright-trace: [open, actions, close]
  deny:
    tools:
      playwright-cli: [eval, run-code, route, unroute]
```

## Variáveis

`${NOME}` num texto do `agent.yaml` é substituído pelo choliba antes de qualquer coisa rodar. O catálogo é
fechado: um nome fora da lista abaixo, ou usado onde não vale, impede o agente de carregar, com o campo onde está.

**Onde valem**: no texto do agente (`role`, `context`, `input`, `flow`, `output`, `notes`), nas `instructions` de
skills e MCPs, em `permissions` (caminhos, diretórios de `execute` e comandos) e nos argumentos das ações de
`steps`. **Onde não valem**: `agent`, `models`, `task` e as `tools` de um MCP, que são valores fixos da declaração.

### `${CHOL_ROOT}`

A pasta de trabalho (a pasta cujo `package.json` depende do choliba). Existe sempre; o choliba a descobre sozinho, e
defini-la no `.env` ou no ambiente é erro.

```yaml
permissions:
  allow:
    execute:
      '${CHOL_ROOT}/': [bunx choliba tests] # os comandos rodam a partir da raiz
```

### `${CHOL_AGENTS_DIR}`

A pasta dos agentes. Existe sempre: `CHOL_AGENTS_DIR` do `.env`, ou `.choliba/agents`.

```yaml
permissions:
  deny:
    read: ['${CHOL_AGENTS_DIR}/'] # o agente não lê a definição de outros agentes
```

### `${CHOL_SKILLS_DIR}`

A pasta das skills. Existe sempre: `CHOL_SKILLS_DIR` do `.env`, ou `.choliba/skills`.

```yaml
permissions:
  allow:
    read: ['${CHOL_SKILLS_DIR}/playwright-cli/']
```

### `${CHOL_MCPS_DIR}`

A pasta dos MCPs. Existe sempre: `CHOL_MCPS_DIR` do `.env`, ou `.choliba/mcps`.

```yaml
permissions:
  deny:
    write: ['${CHOL_MCPS_DIR}/'] # o agente não altera a configuração dos MCPs
```

### `${CHOL_GLOBAL_DIR}`

A pasta global, dos artefatos das execuções. Existe com `CHOL_GLOBAL_DIR` no `.env`.

```yaml
permissions:
  allow:
    read: ['${CHOL_GLOBAL_DIR}/shared/']
```

### `${CHOL_PROJECTS_DIR}`

A pasta de todos os projetos. Existe com `CHOL_GLOBAL_DIR` no `.env`: `CHOL_PROJECTS_DIR` do `.env`, ou
`<CHOL_GLOBAL_DIR>/projects`.

```yaml
permissions:
  deny:
    read: ['${CHOL_PROJECTS_DIR}/'] # nenhum projeto além do liberado por PROJECT_DIR
```

### `${CHOL_TICKET_RUNS}`

A pasta das execuções por ticket. Existe com `CHOL_GLOBAL_DIR` no `.env`, quando `CHOL_TICKET_RUNS` está configurada.

```yaml
permissions:
  allow:
    read: ['${CHOL_TICKET_RUNS}/${TICKET}/']
```

### `${PROJECT}`

O nome do projeto da execução. Existe com `--project`.

```yaml
role: |
  Você é o Test Writer do projeto `${PROJECT}`.
```

### `${PROJECT_DIR}`

A pasta do projeto. Existe com `--project`.

```yaml
permissions:
  allow:
    read: ['${PROJECT_DIR}/config.json', '${PROJECT_DIR}/tests/']
```

### `${APP_DIR}`

O código da aplicação do ambiente ativo do projeto (`appDir` do `config.json`). Existe com `--project`.

```yaml
permissions:
  allow:
    write: ['${APP_DIR}/'] # o implementer só muda a aplicação
```

### `${TICKET}`

A chave do ticket da execução (ex.: `TT-12`). Existe com `--type` ou `--ticket`, que exigem `ticket_types`.

```yaml
permissions:
  allow:
    write: ['${PROJECT_DIR}/tests/${TICKET}.spec.ts']
```

### `${TICKET_FILE}`

O arquivo JSON do ticket da execução. Existe com `--type` ou `--ticket`, que exigem `ticket_types`.

```yaml
permissions:
  allow:
    write: ['${TICKET_FILE}'] # o product-owner só grava o ticket
```

### `${AGENT_EXIT_CODE}`

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
- `${CHOL_GLOBAL_DIR}`, `${CHOL_PROJECTS_DIR}` e `${CHOL_TICKET_RUNS}` só exigem o `.env` configurado se o agente usar uma
  delas.

**Não confundir** com as variáveis dos `.json` de MCP. Um `.choliba/mcps/<nome>.json` também usa `${NOME}`, mas
preenchido com **qualquer** variável do `.env`, sem catálogo:

```json
{
  "command": "node",
  "args": ["${SERVER_DIR}/dist/main.js"],
  "env": { "LOG_DIR": "${LOG_DIR}" }
}
```

`SERVER_DIR` e `LOG_DIR` vêm do `.env`; não fazem parte do catálogo do `agent.yaml`.

## Steps

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
