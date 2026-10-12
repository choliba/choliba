# Ciclo de execução de um agente

> O ciclo de um comando de agente: as três fases, o que o choliba faz sem modelo e o que fica com o provider.

Um comando (`bunx choliba run agent <agente> …`) passa por três fases. Nas fases 1 e 3 quem executa é o **choliba**, sem
modelo. Na fase 2 executa o **agente**: o provider (Claude Code ou Cursor) rodando o modelo, só dentro das
permissões do `agent.yaml`.

**Fase 1: o choliba, antes do agente**

1. Lê os argumentos e recusa `CHOL_ROOT` no `.env` ou no ambiente.
2. Carrega o `agent.yaml` e o valida (schema, pasta, modos, variáveis).
3. Recusa as flags que o agente não aceita; `--help` mostra a ajuda do agente e sai.
4. Valida o projeto (`--project`) e prepara o ticket (`--type` para um novo, `--ticket` para um existente).
   Com `--project`, roda o `setup` da aplicação e garante que ela está no ar, subindo-a com o `start` se preciso;
   sem `start` e fora do ar, para aqui (veja [A aplicação do projeto](aplicacao-do-projeto.md)).
5. Define a tarefa, o modo e o plano salvo (`--plan-from`).
6. Preenche as [variáveis](agent-yaml.md#variáveis), confere o `--model`, confere que cada skill e cada MCP existe
   (o servidor do MCP também, quando é um arquivo) e escolhe o provider.
7. Roda o `steps.<modo>.before`. Uma falha para aqui.
8. Monta os prompts: o de sistema (skills, permissões, o projeto, MCPs e o texto do agente) e o do usuário (aviso do
   modo, plano salvo e a tarefa, com o que o `before` produziu). Com `--project`, o projeto diz onde a aplicação
   roda e que o agente nunca a sobe nem mexe em `node_modules`, o que o choliba também aplica nas permissões (veja
   [A aplicação do projeto](aplicacao-do-projeto.md)).
9. Com `--dry-run`, mostra o que aconteceria e sai (veja [`--dry-run`](../comandos/run.md#--dry-run)).
10. Cria o ticket novo (`--type`).

**Fase 2: o agente**

11. O choliba cria as ferramentas da run ao lado de `.cache/runs/<id>/`, e o provider roda nessa pasta vazia, com os
    dois prompts. O agente lê, grava, roda os comandos de `allow.execute` e as ferramentas da run e chama as tools
    dos MCPs; em `plan` e `ask`, não grava nada. Se ele chama um subagente, o choliba interrompe a execução (veja
    [Segurança](seguranca.md)).

    O terminal mostra cada ferramenta que o agente chama (`→`) e, quando uma falha, onde e por quê, igual em
    qualquer provider: `✗ Shell bun install: negado (comando fora de allow.execute)` diz qual chave do
    `agent.yaml` liberaria a chamada; `✗ Read src/x.ts: erro: File not found` é o erro da própria ferramenta.

    Num terminal, a saída do agente vai num quadro com o nome dele, uma linha abaixo do comando, e uma tabela fica
    fixa no rodapé com o contexto da execução. Entre os dois, quando o provider manda o raciocínio, o painel
    `pensando` mostra as últimas 5 linhas dele:

    ```
    $ bunx choliba run agent product-owner --project app --ticket app-1 "liste o conteúdo do ticket"

    ┌─ product-owner ─────────────────────────────────────────────────────────────────┐
    │ Vou ler o ticket app-1.                                                         │
    │ → Read: …/projects/app/tickets/1.json                                           │
    └─────────────────────────────────────────────────────────────────────────────────┘
    ┌─ pensando ──────────────────────────────────────────────────────────────────────┐
    │ O ticket é uma história e o ambiente é development. Vou abrir a página          │
    │ principal.                                                                      │
    │                                                                                 │
    │                                                                                 │
    │                                                                                 │
    └─────────────────────────────────────────────────────────────────────────────────┘
    provider │ modelo │ sandbox │ imagem        │ container          │ decorrido
    ─────────┼────────┼─────────┼───────────────┼────────────────────┼─────────────
    cursor   │ Auto   │ docker  │ choliba-agent │ choliba-2026-10-1… │ 00:00:17.312
    ```

    As linhas novas entram no quadro, acima do rodapé; uma linha comprida quebra dentro dele (uma palavra maior que
    a linha, como um caminho, quebra no meio). O modelo aparece quando o provider o informa. Sem container, a tabela
    não tem `imagem` nem `container`. Num terminal estreito, as colunas longas são cortadas com `…` e, se a tabela não
    couber, ela vira uma linha só (`cursor · Auto · docker · 00:00:17.312`), sem o painel `pensando`. Quando a sessão termina, o quadro
    se fecha e fica uma linha de resumo: `cursor · Auto · docker · decorrido 00:03:10.482 · código 0`. Os passos das
    fases 1 e 3 rodam fora do quadro.

    O painel `pensando` traz só o texto do raciocínio (os deltas do Cursor, os blocos `thinking` do Claude), sem
    linhas em branco; um raciocínio que vem depois de outra ação começa numa linha nova. Ele aparece no primeiro
    trecho, fica com a mesma altura até o fim e some com o rodapé: o raciocínio não vai para o histórico do terminal.

    Num pipe, num arquivo ou com `TERM=dumb`, não há quadro, painel nem tabela, e o raciocínio não é mostrado: cada linha leva o rótulo do agente
    (`[product-owner] → Read: …`), e a primeira diz o provider e onde ele roda (`[provider] cursor · docker · …`).

**Fase 3: o choliba, depois do agente**

12. Apaga a pasta da execução e as ferramentas da run e desfaz o que o provider preparou (os arquivos `.cursor/` do
    Cursor), seja qual for o resultado. Com o Cursor, apaga também o que ele guardou para a pasta da execução em
    `~/.cursor` (`projects/` e `chats/`), que de outro modo se acumularia a cada execução.
13. Roda o `steps.<modo>.after`: `success` ou `failure`, depois `always`.
14. Fecha o ticket: um ticket novo que o agente não tocou é apagado; em `execute`, sobrar `CHANGE_ME` é erro.
15. Derruba a aplicação, se foi ele quem a subiu no passo 4.

O que cada agente do repositório faz em cada fase, em `execute`:

| Agente          | Fase 1 (`before`)                                                            | Fase 2 (agente)                                                | Fase 3 (`after`)                                               |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `product-owner` | nada; com `--type`, o choliba cria o ticket                                  | usa a aplicação no navegador, consulta o Jira e grava o ticket | nada; o choliba fecha o ticket                                 |
| `test-writer`   | nada                                                                         | grava `tests/<ticket>.spec.ts` e roda os testes do ticket      | `success`: `tests --expect red`, que grava o resumo das falhas |
| `implementer`   | `tests --expect red` (há o que implementar?) e o resumo das falhas no prompt | muda só `APP_DIR` e roda os testes                             | `success`: `tests --expect green` e os testes do projeto       |
