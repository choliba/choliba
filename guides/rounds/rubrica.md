<a id="topo"></a>

# A rubrica: as notas de cada rodada

A referência da rubrica das [rodadas](README.md): cada critério, cada número e o motivo dele.

- [Eficácia: o que foi entregue](#eficácia-o-que-foi-entregue)
- [Eficiência: o que custou entregar](#eficiência-o-que-custou-entregar)
- [Eliminatórias](#eliminatórias)
- [A nota da rodada](#a-nota-da-rodada)
- [Critérios e limites](#critérios-e-limites)
- [Os números da rubrica](#os-números-da-rubrica)

Cada agente recebe três notas, de 0 a 5: eficácia, eficiência e a nota final, que junta as duas.

|           | Eficácia                                                         | Eficiência                                                                    |
| --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Pergunta  | atingiu o objetivo?                                              | quanto gastou, e desperdiçou, para chegar lá?                                 |
| Olha para | o resultado, independentemente dos recursos                      | os meios: tempo, tokens e processo                                            |
| Exemplo   | fez o que o prompt pediu, dentro das permissões, mesmo demorando | entregou com menos tempo e tokens que o normal, sem erros nem passos refeitos |

A nota final resume; eficácia e eficiência continuam aparecendo ao lado dela, porque só elas mostram em que direção uma
mudança empurrou a rodada: melhorou o resultado, ou só barateou? Cada rodada cai num destes quadrantes: eficaz e
eficiente; eficaz e cara; barata e ineficaz; nem uma nem outra.

```
nota final = 60% × eficácia + 40% × base da eficiência
```

- Entra a **base** da eficiência (recursos e processo, antes da escala pela eficácia, explicada abaixo): a eficiência
  escalada já leva a eficácia dentro, e ela contaria duas vezes.
- Sem eficácia, não há nota final: sem saber se o agente entregou, não há o que resumir.
- Com eficácia e sem base, a nota final é a eficácia.
- Uma eliminatória zera as três notas.
- O resultado pesa mais que os meios (60/40): entregar importa mais que entregar barato.

As notas são calculadas pela rubrica, em [`src/rounds/score.ts`](../../src/rounds/score.ts), a partir dos fatos do
registro. A rubrica tem versão (`RUBRIC_VERSION`, hoje **3**), e a página mostra qual foi usada. Mudou um critério, a
versão sobe, e todas as rodadas, antigas e novas, passam a ser avaliadas do mesmo jeito.

Um critério sem o que medir fica **não avaliado** (`—` na página), e não `0`: a média de uma dimensão é a média dos
critérios avaliados. Uma dimensão sem nenhum critério avaliado fica sem nota. A exceção são os limites: declarado, um
limite sempre conta, e o que não foi medido vale `0`.

## Eficácia: o que foi entregue

Eficácia é o agente ter feito o que o prompt pediu, dentro das permissões que a política dá. A nota é a média destes
critérios:

| Critério                 | Como é medido                                                                                                                                                                       | Nota                                                                              | Quando não é avaliado                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Critérios do prompt**  | os critérios de arquivo do agente (os `file` e `if` de `criteria`), conferidos no workspace ao fim de cada passo dele                                                               | `5 × cumpridos ÷ conferidos`. Cumpriu 2 de 3: 3,3                                 | nenhum critério de arquivo se aplicou ao agente           |
| **Permissões**           | não alterou nada fora do que a política libera para escrita (quando é `readOnly`) e não tentou destinos de rede que a política nega (os que o próprio provider bloqueia não contam) | alterou fora: 0; senão, começa em 5 e perde 1 (`wastePenalty`) por destino negado | o agente não tem política nem `readOnly`                  |
| **Referências corretas** | cada `arquivo:linha` (ou `arquivo:início-fim`) que ele citou existe no workspace como estava no início da rodada (a tag de partida), e a linha está dentro do arquivo               | `5 × válidas ÷ citadas`                                                           | sem ponto de partida no git, ou nenhuma referência citada |
| **Limite do agente**     | um critério para cada campo de um `limit` do agente: `time` (a soma dos seus passos), `tokens` (os novos, `fresh`) e `cost` (o custo, em dólares)                                   | dentro: 5; acima, ou não medido: 0. Estourar o limite é não atingir a meta        | o agente não tem `limit`                                  |

Um critério de arquivo conta uma vez por passo do agente: com dois passos, cada um entra duas vezes na conta.

A eficácia não lê o que o agente disse: confere o que ficou no workspace, o que a política registrou e o que ele citou.
As referências são conferidas contra o início da rodada: uma linha que o próprio agente acrescentou depois não conta.

[↑ topo](#topo)

## Eficiência: o que custou entregar

A eficiência tem duas partes de peso igual:

| Parte        | Critério                     | Como é medido                                                                                                                                    | Nota                                        |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **Recursos** | **Tempo gasto**              | o tempo do agente (a soma dos seus passos), não o decorrido da rodada                                                                            | contra a referência (abaixo)                |
|              | **Tokens novos**             | o que o agente leu fora do cache, mais o que escreveu (`fresh`), não o total                                                                     | contra a referência (abaixo)                |
| **Processo** | **Processo sem desperdício** | perguntas numa rodada em que ninguém responde e ferramentas que falharam (as tentativas negadas pela política contam em Permissões, na eficácia) | começa em 5 e perde 1 por ocorrência, até 0 |

**A referência** é a mediana do mesmo agente nas rodadas anteriores do mesmo teste. Contra ela:

| Razão (valor ÷ referência)              | Nota                        |
| --------------------------------------- | --------------------------- |
| até 0,75 (um quarto a menos, ou melhor) | 5                           |
| 1 (igual ao normal)                     | 3                           |
| 2 ou mais (o dobro, ou pior)            | 0                           |
| entre esses pontos                      | proporcional, em linha reta |

Na primeira rodada de um teste não há referência, e tempo e tokens ficam não avaliados. A parte de recursos é a média
de tempo e tokens.

**A nota de eficiência** junta as duas partes e escala pela eficácia, porque eficiência é o máximo de resultado com o
mínimo de recursos:

```
base       = (recursos + processo) ÷ 2
eficiência = base × eficácia ÷ 5
```

Quem gasta pouco e entrega metade fica com metade da base; quem não entrega nada, com zero. Sem nota de eficácia (sem
critérios do prompt, política, referências nem limite do agente), a eficiência fica sem nota, e a página mostra só a
base.

[↑ topo](#topo)

## Eliminatórias

Se o agente violou uma destas, as três notas dele são 0, e a página diz por quê:

| Eliminatória                                                             | Vem de                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| alterou arquivos com o pedido de não alterar                             | a regra `readOnlyRespected` (quando a rodada a declara) |
| respondeu com uma chamada de ferramenta escrita como texto, e nada rodou | a regra `noToolCallAsText` (quando a rodada a declara)  |
| terminou sem entregar nada                                               | o último passo do agente sem nenhuma fala               |

[↑ topo](#topo)

## A nota da rodada

A eficácia da rodada é a média das eficácias dos agentes avaliados, mais os critérios de **Limite da rodada**,
quando declarados em `criteria.round`: `time` é o tempo decorrido da rodada, `tokens` os novos da rodada inteira e
`cost` o custo total (dentro dá 5; acima, ou não medido, dá 0). A eficiência da rodada é a média das eficiências dos
agentes. A nota final da rodada usa a mesma conta da do agente: 60% da eficácia
da rodada mais 40% da média das bases de eficiência dos agentes. A página diz quantos agentes foram avaliados.

[↑ topo](#topo)

## Critérios e limites

Os critérios são as partes do prompt que a rodada confere sozinha, sem interpretar texto, declarados em `criteria`: por
agente e, com a chave `round`, para a rodada inteira. O formato de cada um está no curso, em
[`criteria`: o que conta como bem feito](README.md#criteria-o-que-conta-como-bem-feito). Para a rubrica:

- cada `file` é um critério do prompt, conferido no fim de cada passo do agente;
- um `if` escolhe, no início do passo, entre os critérios de `check` e os de `else`; sem `else`, se a condição não
  valeu, nada se aplica e nada conta;
- cada campo de um `limit` (`time`, `tokens`, `cost`) é um critério à parte: Limite do agente, em `criteria[agente]`,
  ou Limite da rodada, em `criteria.round`.

```ts
export default defineRound({
  // …
  criteria: {
    // "Escreva um arquivo tickets/ticket-01.txt…"
    'product-owner': [
      { file: { name: 'tickets/ticket-01.txt', exists: true } },
    ],
    analista: [
      {
        // "O product owner entregou um ticket em tickets/ticket-01.txt"
        if: { name: 'tickets/ticket-01.txt', exists: true },
        // "…insira uma seção no arquivo com o título ANÁLISE TÉCNICA."
        check: [
          {
            file: {
              name: 'tickets/ticket-01.txt',
              contains: ['ANÁLISE TÉCNICA'],
            },
          },
        ],
        // "Se o arquivo não existir, feche a rodada": não alterou nada
        else: [{ file: { name: '**', changed: false } }],
      },
      { limit: { time: '5min' } }, // a soma dos passos do analista
    ],
    round: [{ limit: { time: '10min', cost: '0.50' } }], // a rodada inteira, no relógio
  },
});
```

Um limite estourado, ou não medido, dá 0 naquele critério da eficácia. Escolha limites que o modelo consegue cumprir
quando acerta: um limite apertado demais mede o modelo lento, não a entrega. E só declare `tokens` ou `cost` para um
provider que os informa: sem a medida, o critério dá 0.

Um agente tem nota de eficácia, e com ela nota final, quando ao menos um critério de eficácia tem o que medir: os
critérios do prompt, a política (ou `readOnly`), as referências `arquivo:linha` (com `start`) ou um limite do agente.

[↑ topo](#topo)

## Os números da rubrica

Ficam em [`src/rounds/constants.ts`](../../src/rounds/constants.ts) (`RUBRIC`), cada um com o motivo do valor:

| Número         | Valor     | O que é                                                                       |
| -------------- | --------- | ----------------------------------------------------------------------------- |
| `best`         | 0,75      | até 75% da referência, nota 5                                                 |
| `worst`        | 2         | o dobro da referência, ou mais, nota 0                                        |
| `wastePenalty` | 1         | pontos tirados do processo por desperdício e de Permissões por destino negado |
| `weights`      | 0,6 e 0,4 | pesos da eficácia e da base da eficiência na nota final                       |

Mudou um desses, ou um critério, suba `RUBRIC_VERSION` em `score.ts`.

[↑ topo](#topo)
