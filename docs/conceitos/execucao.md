# O que acontece numa execução

Um comando (`bunx choliba <agente> …`) passa por três fases. Nas fases 1 e 3 quem executa é o **choliba**, sem
modelo. Na fase 2 executa o **agente**: o provider (Claude Code ou Cursor) rodando o modelo, só dentro das
permissões do `agent.yaml`.

**Fase 1: o choliba, antes do agente**

1. Lê os argumentos e recusa `CHOL_ROOT` no `.env` ou no ambiente.
2. Carrega o `agent.yaml` e o valida (schema, pasta, modos, variáveis).
3. Recusa as flags que o agente não aceita; `--help` mostra a ajuda do agente e sai.
4. Valida o projeto (`--project`) e prepara o ticket (`--type` para um novo, `--ticket` para um existente).
5. Define a tarefa, o modo e o plano salvo (`--plan-from`).
6. Preenche as [variáveis](../referencia/agent-yaml.md#variáveis), confere o `--model`, confere que cada skill e cada MCP existe e escolhe o
   provider.
7. Roda o `steps.<modo>.before`. Uma falha para aqui.
8. Monta os prompts: o de sistema (skills, permissões, MCPs e o texto do agente) e o do usuário (aviso do modo,
   plano salvo e a tarefa, com o que o `before` produziu).
9. Com `--dry-run`, mostra o que aconteceria e sai (veja [`--dry-run`](../guias/dry-run.md)).
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
