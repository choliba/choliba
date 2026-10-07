# Escrevendo um agente

Um agente é uma pasta `.choliba/agents/<id>/` com um arquivo só, o `agent.yaml`. Ele declara tudo: o que o choliba lê e
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
      Onde a skill escreve `playwright-cli <comando>`, rode a ferramenta `playwright-cli` pelo caminho que o bloco de
      permissões traz, seguida do `<comando>`.
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
      '${CHOL_ROOT}/': [bunx choliba tests]
      '${APP_DIR}/': [git log, git diff]
    tools:
      playwright-cli: ['*']
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

O que cada chave quer dizer, se é obrigatória e o padrão: [referência do `agent.yaml`](../referencia/agent-yaml.md).

## O texto do agente

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

## Skills e MCPs

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

O agente só usa os MCPs que declara. Chamar uma tool de um servidor não declarado, ou uma tool fora das que o item
lista, interrompe a execução com código 1. Num agente sem `mcps`, procurar tools de MCP (o `GetMcpTools` do
Cursor, por exemplo) também interrompe. Veja [Segurança](../conceitos/seguranca.md).
