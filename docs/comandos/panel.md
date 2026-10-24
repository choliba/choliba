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

O painel abre com as boas-vindas: Enter mostra o campo, e Esc sai. No campo, `/` lista os comandos do painel. Um comando não se repete na conversa: o que ele escolhe, ele diz (`Projeto loja selecionado.`, `Agente test-writer adicionado.`). `/projects` escolhe o projeto e já pergunta o ticket, e `/tickets` troca o ticket.

O que os comandos escolhem aparece no cabeçalho, em quadros que entram recolhidos e que o Ctrl+P (projeto) ou um clique abrem, por cima da conversa, e recolhem. Cada agente da sequência tem o seu quadro, ligado ao anterior por uma seta, com a borda esquerda na cor do agente: a primeira linha diz `aguardando`, `concluído` ou `falhou` com o tempo, e enquanto ele roda, uma barra e há quanto tempo; as outras, o provider e o modelo que ele usa e o ticket. Arrastar o quadro de um agente com o mouse e soltar sobre o de outro o põe no lugar dele, menos enquanto os agentes rodam. Sem espaço no cabeçalho, os quadros dos agentes estreitam.

`/agents` acrescenta um agente ao fim da sequência: ele escolhe o provider, entre os que o agente declara, e depois o modelo, entre os que ele declara para esse provider; Esc em qualquer dos dois usa o do painel, e um agente que não pode rodar com eles não entra, e o painel diz por quê. Depois, `/agents` pergunta pelo próximo. Escolher um agente que já está na sequência troca só o provider e o modelo dele, menos o que roda agora. `/agents` nunca recomeça a sequência (`/clear` recomeça) e funciona enquanto ela roda: um agente acrescentado roda no fim, e um que espera roda com o que foi escolhido para ele.

A coluna do cabeçalho mostra o provider e o modelo do painel, os dos agentes que não escolheram os seus: `/provider` os escolhe entre `auto` e todos os providers, e `/model` entre os modelos que os agentes declaram para ele e o padrão, em que cada agente roda o primeiro modelo que declara. A linha de status mostra o modo, que o Shift+Tab alterna e `/mode` escolhe entre os que o primeiro agente aceita, o sandbox onde o provider roda (o de CHOL_SANDBOX), que `/sandbox` troca para a sessão e reinicia a execução se um agente estiver rodando, e, enquanto um agente roda, há quanto tempo.

Uma mensagem sem `/` é a tarefa do primeiro agente. Os seguintes rodam com a sua tarefa padrão, ou com a mensagem quando não têm uma, e o ticket que um deixa é o do próximo (sem ticket, um agente de tickets pergunta o tipo do ticket novo que a execução cria). Entre dois agentes, o painel pergunta se segue: Enter segue, e Esc para a sequência. Ela também para quando um agente falha, quando o Ctrl+C o interrompe e quando uma execução em `execute` deixa intacto o ticket que criou. `/resume` volta a qualquer agente da sequência, parada ou já terminada: escolhido o agente, o que se digita é dito a ele (vazio ou Esc repete a tarefa dele), e a sequência roda de novo a partir dele, com o ticket da sessão.

Enquanto um agente roda, o que se envia vai para ele, e as perguntas dele aparecem no campo. As linhas de cada agente aparecem num bloco com a borda na cor dele e o nome no começo; as do choliba, com `●`. Ctrl+C duas vezes para a execução; sem nada rodando, sai do painel. `/quit` sai do painel depois de parar a execução e esperar que ela termine, para nenhum processo ficar rodando. `/clear` para o que roda e limpa o contexto (projeto, ticket e agentes) e a conversa.

Cada sessão grava `.cache/logs/painel/<data e hora>.log`, sem cores: o que se envia, os comandos, as escolhas, as perguntas e respostas, o que o choliba responde e as linhas de cada agente, que tem também o seu log de execução em `.cache/logs/<agente>/`. Precisa de um terminal interativo.

## Opções

| Opção          | Descrição         |
| -------------- | ----------------- |
| `-h`, `--help` | Mostra esta ajuda |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
