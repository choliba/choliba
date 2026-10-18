# Ciclo de execução de um agente

> O ciclo de um comando de agente: as três fases, o que o choliba faz sem modelo e o que fica com o provider.

Um comando (`bun choliba run agent <agente> …`) passa por três fases. Nas fases 1 e 3 quem executa é o **choliba**, sem
modelo. Na fase 2 executa o **agente**: o provider (Claude Code, Codex ou Cursor) rodando o modelo, só dentro das
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
    dos MCPs; em `plan` e `ask`, não grava nada. Cada chamada de ferramenta é decidida pelo sandbox: se ele chama um
    subagente, um MCP que não declara ou uma ferramenta que o provider não consegue limitar, o choliba interrompe a
    execução (veja [Segurança](seguranca.md) e [Permissões](permissoes.md)).

    O terminal mostra cada ferramenta que o agente chama (`→`) e, quando uma falha, onde e por quê, igual em
    qualquer provider: `✗ Shell bun install: negado (comando fora de allow.execute)` diz qual chave do
    `agent.yaml` liberaria a chamada; `✗ Read src/x.ts: erro: File not found` é o erro da própria ferramenta.

    Se a última resposta do agente é só uma chamada de ferramenta escrita como texto, o modelo não chamou a
    ferramenta e nada rodou: o choliba falha a execução e diz qual modelo e qual ferramenta, mesmo com o provider
    saindo com 0.

    Num terminal, o agente roda numa tela própria: o quadro com o nome dele em cima e, embaixo, uma linha entre dois
    traços com um campo à esquerda e o contexto da execução à direita:

    ```
    ┌─ product-owner ─────────────────────────────────────────────────────────────────┐
    │ Vou ler o ticket app-1.                                                         │
    │ → Read: …/projects/app/tickets/1.json                                           │
    └─────────────────────────────────────────────────────────────────────────────────┘
    ───────────────────────────────────────────────────────────────────────────────────
    ❯ Enter envia · Ctrl+J cria uma linha               cursor · Auto · docker · 00:00:17.312
    ───────────────────────────────────────────────────────────────────────────────────
    ```

    - **Rolar.** O quadro acompanha as linhas novas até você rolar para cima, com a roda do mouse, PgUp/PgDn ou Home;
      End volta ao fim. Uma linha comprida quebra dentro do quadro. O modelo aparece quando o provider o informa.
    - **Responder.** Quando o agente pergunta (a ferramenta da run `ask`), a pergunta ocupa o campo: escreva e tecle
      Enter. Use Ctrl+J para inserir outra linha. Em terminais que distinguem a combinação, Shift+Enter também funciona. Com
      opções, escolha com as setas e Enter, e marque várias com Espaço; Tab passa para o campo, onde o que você
      escrever responde quando nenhuma opção serve. Esc pula a pergunta, e o agente segue com uma premissa. A pergunta
      e a resposta ficam no quadro (`? …` e `→ …`).
    - **Escrever.** Sem pergunta pendente, o que você envia vai para a sessão, e o agente lê quando termina o passo em
      que está; fica no quadro como `› …`. O Claude (e o `claude-ollama`) recebe a tarefa e as mensagens pelo stdin, e
      a sessão termina quando o agente responde à última. O Codex e o Cursor não recebem mensagens durante a execução: o campo
      diz isso, e uma mensagem enviada aparece como `› … (não entregue: …)`.
    - **Interromper.** O primeiro Ctrl+C só avisa no campo; o segundo, em até 2 segundos, interrompe a execução.

    Quando a sessão termina, a tela se fecha e o terminal recebe o quadro inteiro e uma linha de resumo:
    `cursor · Auto · docker · decorrido 00:03:10.482 · código 0`. Os passos das fases 1 e 3 rodam fora do quadro.
    Onde a tela não abre, o quadro vai direto no terminal, com o contexto fixo no rodapé, e uma pergunta do agente
    fica sem resposta na hora.

    Num pipe, num arquivo ou com `TERM=dumb`, não há quadro nem painel: cada linha leva o rótulo do agente
    (`[product-owner] → Read: …`), e a primeira diz o provider e onde ele roda (`[provider] cursor · docker · …`).

**Fase 3: o choliba, depois do agente**

12. Apaga a pasta da execução e as ferramentas da run e desfaz o que o provider preparou (a cópia isolada da
    autenticação do Codex e os arquivos `.cursor/` do Cursor), seja qual for o resultado. Com o Cursor, apaga também o que ele guardou para a pasta da execução em
    `~/.cursor` (`projects/` e `chats/`), que de outro modo se acumularia a cada execução.
13. Roda o `steps.<modo>.after`: `success` ou `failure`, depois `always`.
14. Fecha o ticket: um ticket novo que o agente não tocou é apagado; em `execute`, sobrar `CHANGE_ME` é erro.
15. Derruba a aplicação, se foi ele quem a subiu no passo 4.

**O log da execução.** Toda execução, menos `--dry-run`, grava um log em `.cache/logs/<agente>/<data e hora>.log`, e a
última linha na tela diz onde ele está (`log em …`). Ele é escrito enquanto a execução acontece, uma linha de cada vez:
uma execução interrompida deixa o log até onde chegou. Começa com o agente, o modo, o projeto, o ticket, o sandbox e a
tarefa; depois, cada linha com a hora e a origem:

- `[saida]` e `[erro]`: o que o choliba mostrou (os steps, a aplicação, o agente, as paradas), sem as cores;
- `[provider]` e `[provider-erro]`: cada linha que o provider escreveu, como chegou, antes de o choliba traduzi-la;
- `[choliba]`: o provider e o modelo da execução, o código e o tempo do agente quando a sessão termina, e o código e
  o tempo total no fim.

```text
2026-10-18T22:22:14.481Z [choliba] provider codex · modelo gpt-6-luna
2026-10-18T22:22:15.313Z [provider] {"type":"thread.started","thread_id":"…"}
2026-10-18T22:22:18.284Z [erro] ✗ o agente rodou ls /tmp, fora de permissions.execute; a execução foi interrompida.
2026-10-18T22:22:18.301Z [choliba] agente terminou: código 1 · tempo do agente 3.8s
2026-10-18T22:22:18.306Z [choliba] fim: código 1 · tempo total 3.8s
```

Os logs ficam até alguém apagar `.cache/`. Como trazem o que o agente leu e respondeu, não os compartilhe sem olhar.

O que cada agente do repositório faz em cada fase, em `execute`:

| Agente          | Fase 1 (`before`)                                                            | Fase 2 (agente)                                                | Fase 3 (`after`)                                               |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `product-owner` | nada; com `--type`, o choliba cria o ticket                                  | usa a aplicação no navegador, consulta o Jira e grava o ticket | nada; o choliba fecha o ticket                                 |
| `test-writer`   | nada                                                                         | grava `tests/<ticket>.spec.ts` e roda os testes do ticket      | `success`: `tests --expect red`, que grava o resumo das falhas |
| `implementer`   | `tests --expect red` (há o que implementar?) e o resumo das falhas no prompt | muda só `APP_DIR` e roda os testes                             | `success`: `tests --expect green` e os testes do projeto       |
