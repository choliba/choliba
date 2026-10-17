---
group: Ticket e testes
order: 1
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba run`

> Roda um agente da pasta de trabalho ou os testes E2E de um projeto. O tipo vem depois do verbo: agent ou tests.

## Uso

```sh
choliba run TYPE [ARGS]
```

## Exemplos

Implementa o ticket loja-1:

```sh
choliba run agent implementer --project loja --ticket loja-1
```

Roda os testes do projeto loja:

```sh
choliba run tests loja
```

## `agent`

Executa um agente da pasta de trabalho (.choliba/agents/&lt;nome&gt;/) por um provider (auto, claude, claude-ollama, cursor).

### Uso

```sh
choliba run agent AGENT [OPTIONS] [TASK...]
```

### Exemplos

Escreve o ticket de uma story nova a partir de um pedido:

```sh
choliba run agent product-owner --project loja --type story "a busca aceita filtro por data"
```

Escreve os testes do ticket loja-1:

```sh
choliba run agent test-writer --project loja --ticket loja-1
```

Mostra o que a implementação faria, sem executar nada:

```sh
choliba run agent implementer --project loja --ticket loja-1 --dry-run
```

### Detalhes

As flags que um agente aceita dependem do `agent.yaml` dele: `--project` só para quem age num projeto,
`--type` e `--ticket` só para quem tem `ticket_types`, `--mode` só com os modos que ele permite, `--since` só para quem tem um
`git_diff`. `choliba run agent <agente> --help` mostra as do agente; a tabela abaixo tem todas. Uma execução passa
pelo [ciclo de execução](../referencia/ciclo-de-execucao-agente.md): o choliba antes, o modelo, o choliba depois. Num
terminal, a saída do agente vai num quadro, com o provider, o modelo, o sandbox e o tempo decorrido numa tabela no
rodapé.

### `--dry-run`

`--dry-run` mostra, na ordem, o que o comando faria sem ele, e **não executa nada**: nenhum step, nenhum ticket,
nenhuma pasta de execução, nenhum provider. Vale em qualquer modo. Ele só lê o que precisa para montar a lista (o
`agent.yaml`, as skills, os MCPs, o projeto e o ticket), então um problema que faria a execução falhar antes do
agente aparece do mesmo jeito.

```
$ bun choliba run agent implementer --mode plan --dry-run --project app --ticket app-1
Sem --dry-run, faria nesta ordem:

 1. [CLI]    confere http://localhost:5173/: sem resposta, para aqui (o ambiente não tem envs[].start)
 2. [CLI]    plan.before 1/2 — run: bun choliba run tests app:app-1 --expect red --failures .cache/test-writer/app-1/red.md
             se falhar: para aqui, o agente não roda
 3. [CLI]    plan.before 2/2 — read_files: falhas_red .cache/test-writer/app-1/red.md
             se falhar: para aqui, o agente não roda
 4. [agente] cursor · modelo padrão do provider · modo plan · na pasta .cache/runs/<id>
             skills: playwright-trace · MCPs: nenhum
             prompt de sistema: 8053 bytes · prompt do usuário: 218 bytes (--show-prompt mostra os dois)
             comando: agent -p <prompt> --trust --disable-auto-update --output-format stream-json …
 5. [CLI]    plan.after.success (se o agente sair com 0): nada
             plan.after.failure (se o agente falhar): nada
             plan.after.always: nada
 6. [CLI]    fecha o ticket: apaga um ticket novo que o agente não preencheu; em execute, falha se sobrar CHANGE_ME
```

Com `--show-prompt` (só junto de `--dry-run`), a saída segue com os dois prompts completos, a linha de comando
completa (em JSON, um argumento por item) e, no Cursor, o `.cursor/cli.json` da pasta da execução e o
`.cursor/mcp.json` da raiz, como seriam gravados.

Antes do agente, com `--project`, o choliba deixa a aplicação pronta: veja
[A aplicação do projeto](../referencia/aplicacao-do-projeto.md).

### Opções

| Opção                 | Descrição                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--mode <string>`     | Modo de execução (padrão: modes.default do agente):<br>`execute`: Faz a tarefa, com as permissões que o agente declara.<br>`plan`: Só planeja, sem gravar nada, e salva o plano em plans/ para rodar depois com --plan-from.<br>`ask`: Só responde, sem gravar nada.                                                                                                                                                   |
| `--mode-execute`      | Atalho para --mode execute                                                                                                                                                                                                                                                                                                                                                                                             |
| `--mode-plan`         | Atalho para --mode plan                                                                                                                                                                                                                                                                                                                                                                                                |
| `--mode-ask`          | Atalho para --mode ask                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--project <name>`    | Projeto em CHOL_PROJECTS_DIR sobre o qual o agente age; validado antes de chamar o provider                                                                                                                                                                                                                                                                                                                            |
| `--type <type>`       | Tipo do ticket novo, criado pelo CLI a partir do template do tipo:<br>`bug`: Correção de falha: a aplicação faz algo diferente do esperado.<br>`improvement`: Ajuste em algo que já existe: fluxo, texto, usabilidade ou desempenho.<br>`story`: Valor para o usuário: uma capacidade nova, descrita pelo que ele passa a conseguir fazer.<br>`task`: Execução técnica, sem comportamento novo visível para o usuário. |
| `--type-bug`          | Atalho para --type bug                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--type-improvement`  | Atalho para --type improvement                                                                                                                                                                                                                                                                                                                                                                                         |
| `--type-story`        | Atalho para --type story                                                                                                                                                                                                                                                                                                                                                                                               |
| `--type-task`         | Atalho para --type task                                                                                                                                                                                                                                                                                                                                                                                                |
| `--ticket <key>`      | Ticket existente do projeto sobre o qual o agente trabalha                                                                                                                                                                                                                                                                                                                                                             |
| `--plan-from <file>`  | Executa um plano salvo (arquivo em plans/)                                                                                                                                                                                                                                                                                                                                                                             |
| `--since <ref>`       | Base do diff: pending (desde a última execução registrada), HEAD~N, branch, tag ou SHA (padrão: base do git_diff do agente)                                                                                                                                                                                                                                                                                            |
| `--since-pending`     | Atalho para --since pending (desde a última execução registrada)                                                                                                                                                                                                                                                                                                                                                       |
| `--provider <string>` | Provider que roda o agente (padrão: auto):<br>`auto`: O primeiro instalado, nesta ordem: cursor, claude.<br>`claude`: Comando `claude`.<br>`claude-ollama`: Comando `claude`, com um modelo do Ollama (`ollama:<modelo>` em agent.yaml#models) servido em CHOL_OLLAMA_URL.<br>`cursor`: Comando `agent`, `cursor-agent` ou `cursor agent`, o primeiro que estiver instalado.                                           |
| `--auto`              | Atalho para --provider auto                                                                                                                                                                                                                                                                                                                                                                                            |
| `--claude`            | Atalho para --provider claude                                                                                                                                                                                                                                                                                                                                                                                          |
| `--claude-ollama`     | Atalho para --provider claude-ollama                                                                                                                                                                                                                                                                                                                                                                                   |
| `--cursor`            | Atalho para --provider cursor                                                                                                                                                                                                                                                                                                                                                                                          |
| `--model <string>`    | Modelo; precisa estar em models do agente                                                                                                                                                                                                                                                                                                                                                                              |
| `--sandbox <string>`  | Onde o provider roda, só nesta execução (padrão: CHOL_SANDBOX):<br>`local`: Nesta máquina, isolado com bwrap<br>`docker`: Num container do Docker                                                                                                                                                                                                                                                                      |
| `--agents-dir <dir>`  | Pasta dos agentes (padrão: .choliba/agents/)                                                                                                                                                                                                                                                                                                                                                                           |
| `--add-dir <dir>`     | Pasta extra que o agente pode ler (pode repetir); o deny do agente continua valendo                                                                                                                                                                                                                                                                                                                                    |
| `--dry-run`           | Mostra o que seria executado, na ordem, sem executar nada                                                                                                                                                                                                                                                                                                                                                              |
| `--show-prompt`       | Com --dry-run: mostra os prompts e a linha de comando completos (e, no cursor, os arquivos de .cursor/)                                                                                                                                                                                                                                                                                                                |
| `-h`, `--help`        | Mostra a ajuda do agente                                                                                                                                                                                                                                                                                                                                                                                               |

## `tests`

Roda os testes E2E dos projetos com o Playwright. Sem projeto, roda todos; com projeto:ticket, só os daquele ticket.

### Uso

```sh
choliba run tests [PROJECT[:TICKET][/PATH]] [OPTIONS] [PLAYWRIGHT OPTIONS]
```

### Exemplos

Roda os testes de todos os projetos:

```sh
choliba run tests
```

Roda os testes de todos os tickets do projeto loja:

```sh
choliba run tests loja
```

Roda os testes do ticket loja-1:

```sh
choliba run tests loja:1
```

Roda uma lista de tickets (também glob e intervalo):

```sh
choliba run tests loja:1,2
```

Roda um arquivo do projeto:

```sh
choliba run tests loja/tests/a.spec.ts
```

Confere que os testes do ticket falham pelo comportamento, gravando as falhas:

```sh
choliba run tests loja:1 --expect red --failures falhas.md
```

### Detalhes

Antes de rodar, o choliba deixa a aplicação do projeto pronta: veja
[A aplicação do projeto](../referencia/aplicacao-do-projeto.md). `--expect` e `--failures` são os portões que os
agentes usam no TDD; os testes de critérios que outro ticket substituiu saem das rodadas do projeto. Os dois estão
em [Critérios de aceite e portões](../referencia/criterios-e-portoes.md). Qualquer outra opção vai para o
`playwright test` (veja `bunx playwright test --help`).

### Opções

| Opção                   | Descrição                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| `--expect <red\|green>` | O que a execução de um ticket deve mostrar; falha se não mostrar |
| `--failures <file>`     | Grava em FILE como os testes do ticket falharam                  |
| `-h`, `--help`          | Mostra esta ajuda                                                |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
