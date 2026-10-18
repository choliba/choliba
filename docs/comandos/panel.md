---
group: Gerais
order: 11
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba panel`

> Abre o painel interativo do choliba no terminal: as boas-vindas com o logo e, depois do Enter, um campo cujo texto aparece na caixa.

## Uso

```sh
choliba panel
```

## Exemplos

Abre o painel:

```sh
choliba panel
```

## Detalhes

O painel abre com as boas-vindas: Enter mostra o campo, e Esc sai. No campo, `/` lista os comandos do painel (`/projects` escolhe o projeto e já pergunta o ticket, `/tickets` troca o ticket, `/agents` o agente), e o que eles escolhem aparece no cabeçalho, em quadros que entram recolhidos e que o Ctrl+P (projeto), o Ctrl+A (agente) ou um clique abrem, por cima da conversa, e recolhem. Desde o início, a linha de status mostra o modo, que o Shift+Tab alterna, e o sandbox onde o provider roda (o de CHOL_SANDBOX), que `/sandbox` troca para a sessão. Com o agente, o modo fica entre os que ele aceita, e o cabeçalho e o rodapé do quadro do agente mostram o provider e o modelo que uma execução usaria; `/provider`, `/model` e `/mode` os escolhem para a sessão. Enquanto o agente roda, a linha de status mostra também há quanto tempo. Uma mensagem sem `/` é a tarefa do agente: ele roda no painel com essas escolhas (sem ticket, um agente de tickets pergunta o tipo do ticket novo que a execução cria), o que se envia enquanto roda vai para ele, e as perguntas dele aparecem no campo. Ctrl+C duas vezes para a execução; sem nada rodando, sai do painel. `/quit` sai do painel depois de parar a execução e esperar que ela termine, para nenhum processo ficar rodando. `/clear` para o que roda e limpa o contexto (projeto, ticket e agente) e a conversa. Precisa de um terminal interativo.

## Opções

| Opção          | Descrição         |
| -------------- | ----------------- |
| `-h`, `--help` | Mostra esta ajuda |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
