# Ciclo de execução de um agente

> O ciclo de um comando de agente: as três fases, o que o choliba faz sem modelo e o que fica com o provider.

Um comando (`bunx choliba <agente> …`) passa por três fases. Nas fases 1 e 3 quem executa é o **choliba**, sem
modelo. Na fase 2 executa o **agente**: o provider (Claude Code ou Cursor) rodando o modelo, só dentro das
permissões do `agent.yaml`.

**Fase 1: o choliba, antes do agente**

1. Lê os argumentos e recusa `CHOL_ROOT` no `.env` ou no ambiente.
2. Carrega o `agent.yaml` e o valida (schema, pasta, modos, variáveis).
3. Recusa as flags que o agente não aceita; `--help` mostra a ajuda do agente e sai.
4. Valida o projeto (`--project`) e prepara o ticket (`--type` para um novo, `--ticket` para um existente).
   Com `--project`, roda o `setup` da aplicação e garante que ela está no ar, subindo-a com o `start` se preciso;
   sem `start` e fora do ar, para aqui (veja [A aplicação do projeto](comandos.md#a-aplicação-do-projeto)).
5. Define a tarefa, o modo e o plano salvo (`--plan-from`).
6. Preenche as [variáveis](agent-yaml.md#variáveis), confere o `--model`, confere que cada skill e cada MCP existe
   (o servidor do MCP também, quando é um arquivo) e escolhe o provider.
7. Roda o `steps.<modo>.before`. Uma falha para aqui.
8. Monta os prompts: o de sistema (skills, permissões, o projeto, MCPs e o texto do agente) e o do usuário (aviso do
   modo, plano salvo e a tarefa, com o que o `before` produziu). Com `--project`, o projeto diz onde a aplicação
   roda e que o agente nunca a sobe nem mexe em `node_modules`, o que o choliba também aplica nas permissões (veja
   [A aplicação do projeto](comandos.md#a-aplicação-do-projeto)).
9. Com `--dry-run`, mostra o que aconteceria e sai (veja [`--dry-run`](comandos.md#--dry-run)).
10. Cria o ticket novo (`--type`).

**Fase 2: o agente**

11. O choliba cria as ferramentas da run ao lado de `.cache/runs/<id>/`, e o provider roda nessa pasta vazia, com os
    dois prompts. O agente lê, grava, roda os comandos de `allow.execute` e as ferramentas da run e chama as tools
    dos MCPs; em `plan` e `ask`, não grava nada. Se ele chama um subagente, o choliba interrompe a execução (veja
    [Segurança](seguranca.md)).

    O terminal mostra cada ferramenta que o agente chama (`→`) e, quando uma falha, onde e por quê, igual em
    qualquer provider: `✗ Shell bun install: negado (comando fora de allow.execute)` diz qual chave do
    `agent.yaml` liberaria a chamada; `✗ Read src/x.ts: erro: File not found` é o erro da própria ferramenta.

**Fase 3: o choliba, depois do agente**

12. Apaga a pasta da execução e as ferramentas da run e desfaz o que o provider preparou (os arquivos `.cursor/` do
    Cursor), seja qual for o resultado. Com o Cursor, apaga também o que ele guardou para a pasta da execução em
    `~/.cursor` (`projects/` e `chats/`), que de outro modo se acumularia a cada execução.
13. Roda o `steps.<modo>.after`: `success` ou `failure`, depois `always`.
14. Fecha o ticket: um ticket novo que o agente não tocou é apagado; em `execute`, sobrar `CHANGE_ME` é erro.
15. Derruba a aplicação, se foi ele quem a subiu no passo 4.

O que cada agente do repositório faz em cada fase, em `execute`:

| Agente          | Fase 1 (`before`)                                                            | Fase 2 (agente)                                                | Fase 3 (`after`)                                                     |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `product-owner` | nada; com `--type`, o choliba cria o ticket                                  | usa a aplicação no navegador, consulta o Jira e grava o ticket | nada; o choliba fecha o ticket                                       |
| `test-writer`   | nada                                                                         | grava `tests/<ticket>.spec.ts` e roda os testes do ticket      | `success`: `tests --expect red`, que grava o resumo das falhas       |
| `implementer`   | `tests --expect red` (há o que implementar?) e o resumo das falhas no prompt | muda só `APP_DIR` e roda os testes                             | `success`: `tests --expect green` e os testes do projeto             |
| `docs-updater`  | o diff (`git_diff`), a documentação e o README no prompt                     | grava só `docs/` e o `README.md`                               | `success`: Prettier e a base do próximo diff; `always`: apaga o diff |
