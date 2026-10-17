# O `agent.yaml`

> Todas as chaves do `agent.yaml`, as variáveis `${NOME}` que ele aceita e as ações de `steps`, com o schema que
> valida o arquivo.

Todas as chaves do `agent.yaml` (padrão 1), as variáveis `${NOME}` que ele aceita e as ações de `steps`. Um exemplo
completo e o passo a passo estão em [Escrevendo um agente](../guias/escrever-um-agente.md); o schema é
`packages/agents/schemes/v1/agent.schema.json`.

| Chave                             | Obrigatória | Padrão              | O que é                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`                         | sim         | —                   | Versão do padrão: `1`.                                                                                                                                                                                                                                                                                                                                      |
| `agent`                           | sim         | —                   | `id` (igual à pasta, é o nome do comando), `name`, `version` (semver do agente), `description` e, opcional, `color` (cor do rótulo `[agente]`; `CHOL_COLORS` ganha dela).                                                                                                                                                                                   |
| `models`                          | sim         | —                   | Modelos com que o agente pode rodar, pelo id que o provider informa. Um modelo do Ollama é `ollama:<modelo>` (veja [Modelos do Ollama](#modelos-do-ollama)).                                                                                                                                                                                                |
| `role`, `input`, `flow`, `output` | sim         | —                   | O texto do agente (veja [O texto do agente](../guias/escrever-um-agente.md#o-texto-do-agente)).                                                                                                                                                                                                                                                             |
| `context`, `notes`                | não         | nenhum              | Listas de textos que completam o texto do agente.                                                                                                                                                                                                                                                                                                           |
| `skills`                          | não         | `[]`                | Pastas em `.choliba/skills/`, com a instrução de uso de cada uma (veja [Skills e MCPs](../guias/escrever-um-agente.md#skills-e-mcps)).                                                                                                                                                                                                                      |
| `mcps`                            | não         | nenhum              | Servidores em `.choliba/mcps/<nome>.json`, com as tools liberadas e a instrução de uso de cada um. Usar outro MCP interrompe a execução.                                                                                                                                                                                                                    |
| `permissions.allow`/`.deny`       | não         | nada liberado       | `read`, `write` e `delete`: caminhos (sem glob = o item e tudo abaixo). `permissions.exception` tira caminhos de um `deny` (veja [Exceções no deny](#exceções-no-deny)). `execute`: diretório → comandos. `tools`: ferramenta da run → subcomandos (`['*']` = todos; em `deny`, `['*']` tira a ferramenta). Veja [Ferramentas da run](#ferramentas-da-run). |
| `modes.allow` / `.default`        | não         | os três / `execute` | Modos aceitos (`execute`, `plan`, `ask`) e o usado quando a linha de comando não diz.                                                                                                                                                                                                                                                                       |
| `task.required` / `.default`      | não         | `true` / —          | Se a tarefa é obrigatória e, quando não é, qual usar (`default` passa a ser obrigatório).                                                                                                                                                                                                                                                                   |
| `ticket_types`                    | não         | agente sem ticket   | Tipos de ticket aceitos (`story`, `bug`, `improvement`, `task`); a execução pede `--type` ou `--ticket`, a não ser com `allow_without_ticket`.                                                                                                                                                                                                              |
| `allow_without_ticket`            | não         | `false`             | `true` deixa a execução seguir sem `--type`/`--ticket`: com `ticket_types`, o ticket fica opcional; sem, deixa explícito que o agente não usa ticket.                                                                                                                                                                                                       |
| `steps.<modo>.before` / `.after`  | não         | nenhum              | Ações do choliba antes e depois do agente, em cada modo (veja [Steps](#steps)).                                                                                                                                                                                                                                                                             |

Regras de permissão: veja [Segurança](seguranca.md). Em toda execução o choliba acrescenta `deny.write` e
`deny.delete` das pastas de agentes, skills e MCPs; uma exceção dentro delas é recusada. No fim,
compara o sha256 de cada arquivo dessas pastas: se algum foi criado, alterado ou apagado, a execução
termina com código 1 e lista os caminhos, sem desfazer. Delegar a um subagente não é uma permissão: é
negado a todo agente, sem chave no `agent.yaml`.

### Exceções no deny

`permissions.exception`, ao lado de `allow` e `deny`, tem `read`, `write` e `delete`. Cada caminho ali sai de um deny
da mesma ação, como no `.gitignore`. A exceção não libera nada sozinha: o que está nela ainda precisa estar em
`allow`.

```yaml
permissions:
  allow:
    read: ['/home/jackson/dev/teste/', '${CHOL_ROOT}/docs/publico/']
  deny:
    read: ['${CHOL_ROOT}/']
  exception:
    read: ['${CHOL_ROOT}/docs/publico/']
```

O agente lê o app em `/home/jackson/dev/teste/` e, da pasta de trabalho, só `docs/publico/`. A pasta de cada skill
que o agente declara já é uma exceção sozinha: ela não precisa estar em `exception`. Uma exceção que não está dentro
de nenhum deny da mesma ação (ou que fica dentro de um glob) para a execução antes do provider, porque não tira
nada. Uma exceção de `write` ou `delete` dentro das pastas de agentes, skills ou MCPs também para: o choliba nega
escrita e exclusão nelas em toda execução, e nenhuma exceção reabre.

A forma antiga continua aceita: um caminho que começa com `!` dentro de `deny.read`, `deny.write` ou `deny.delete` é
o mesmo que pô-lo em `exception` da mesma ação (`deny: { read: ['${CHOL_ROOT}/', '!${CHOL_ROOT}/docs/publico/'] }`).

## Modelos do Ollama

Um modelo declarado como `ollama:<modelo>` em `models` roda no [Ollama](https://ollama.com), pelo provider
`claude-ollama`: o Claude Code, com as mesmas permissões e as mesmas paradas, falando com o Ollama em vez da API do
Claude.

```yaml
models:
  - claude-sonnet-5
  - 'ollama:qwen3.5:4b'
```

```bash
choliba run agent test-writer --claude-ollama --project loja --ticket loja-1
```

- Sem `--model`, o `claude-ollama` usa o primeiro `ollama:` da lista; com `--model`, o modelo tem que ser um `ollama:`.
  Um agente sem nenhum é recusado antes de rodar.
- Um modelo `ollama:` só roda no `claude-ollama`: com `--claude` ou `--cursor`, o choliba recusa e diz qual provider
  usar.
- O `claude-ollama` não entra no `auto`: roda só quando nomeado (`--provider claude-ollama`, `--claude-ollama` ou
  `CHOL_AGENTS_PROVIDER`).
- O endereço é `CHOL_OLLAMA_URL` (padrão `http://localhost:11434`). O choliba põe esse endereço e o token do Ollama na
  sessão e deixa vazias as credenciais do Claude, para nenhuma delas ir ao Ollama. No docker, veja
  [Ollama](sandbox.md#ollama).
- O modelo precisa saber chamar ferramentas (no `ollama list`, a capacidade `tools`), e o Ollama precisa de contexto
  para o texto do agente: suba o servidor com `OLLAMA_CONTEXT_LENGTH=65536` ou mais. Um modelo pequeno roda, mas segue
  pior o fluxo e as permissões.
- Um modelo que não chama a ferramenta e escreve a chamada como resposta (um JSON com `name` e `arguments`, ou
  `<tool_call>…</tool_call>`) termina a sessão sem rodar nada. O choliba falha a execução e diz qual modelo e qual
  ferramenta: troque por um modelo que faça tool calling.

## Ferramentas da run

O que só os agentes usam não é comando do choliba: é uma ferramenta da run. Em cada execução, o choliba cria o script
de cada ferramenta ao lado da pasta da run (`.cache/runs/<execução>.<ferramenta>`), libera só esse caminho para o
agente, impede que ele seja reescrito e o apaga no fim. O prompt traz o caminho completo de cada uma.

| Ferramenta         | Vem de                     | O que faz                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delete`           | `permissions.allow.delete` | Apaga arquivos e pastas sob esses caminhos; recusa links para fora, a própria raiz e o que `deny.delete` nega. Não existe em `plan`/`ask`.                                                                                                                                                                                                                |
| `playwright-cli`   | `permissions.allow.tools`  | O navegador (`playwright cli`), na versão do choliba, na raiz da pasta de trabalho; grava em `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR`.                                                                                                                                                                                                                            |
| `playwright-trace` | `permissions.allow.tools`  | Lê o `trace.zip` de um teste que falhou (`playwright trace`), na versão do choliba; roda em `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR`, com os caminhos relativos à raiz.                                                                                                                                                                                           |
| `ask`              | `permissions.allow.tools`  | Pergunta algo a quem roda o agente e devolve a resposta: escolha única (`--options a,b`, também aceito como lista JSON ou `--option` repetido), várias (`--multi`) ou texto. O agente segue na mesma sessão com a resposta. Sem resposta (a pessoa pulou, não há terminal ou passaram 25 minutos), sai com 2 e o agente segue com uma premissa explícita. |

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
      '${CHOL_ROOT}/': [bun choliba run tests] # os comandos rodam a partir da raiz
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
      - run: [bun, choliba, run, tests, '${PROJECT}:${TICKET}', --expect, red]
    after:
      success: # o agente saiu com 0
        - run: [bun, choliba, run, tests, '${PROJECT}:${TICKET}', --expect, green]
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
| `read_files`      | `before` | Põe o conteúdo de arquivos no prompt, dentro de uma tag (`<tag>`). |
| `record_git_head` | `after`  | Grava o commit atual, base do próximo `--since pending`.           |

O que o `before` produz entra na tarefa que o agente recebe; cada arquivo do `read_files` e o índice do `git_diff` vão
como dado, dentro de `<untrusted_input>` (veja [Segurança](seguranca.md)). O `after` é um `try/catch/finally` sobre
o agente:

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

Nos dois casos a falha sai tratada no terminal: qual ação, o que ela rodou, o código e as últimas linhas da saída do
comando. A saída inteira, stdout e stderr na ordem em que o comando escreveu, fica num log em `.cache/steps/`, e a
falha diz qual (`saída completa: .cache/steps/….log`); um step que dá certo não deixa log.

```
✗ execute.before 1/2 falhou — run: bun choliba run tests tt:TT-1 --expect red (código 2)
  <as últimas linhas da saída do comando>
  O agente não foi executado.
```

**A mesma lista em vários modos.** O YAML tem âncoras: `&nome` dá um nome à lista que vem logo depois, e `*nome`
a repete em outro lugar. O `implementer` usa isso para que `plan` e `ask` preparem o mesmo contexto de `execute`:

```yaml
steps:
  execute:
    before: &before # a lista do before de execute ganha o nome "before"
      - run: [bun, choliba, run, tests, '${PROJECT}:${TICKET}', --expect, red, --failures, '.cache/test-writer/${TICKET}/red.md']
      - read_files: [falhas_red, '.cache/test-writer/${TICKET}/red.md']
    after:
      success:
        - run: [bun, choliba, run, tests, '${PROJECT}:${TICKET}', --expect, green]
  plan:
    before: *before # a mesma lista do before de execute
  ask:
    before: *before
```
