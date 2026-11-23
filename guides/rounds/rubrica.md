<a id="topo"></a>

# A rubrica: as notas de cada rodada

A referência da rubrica das [rodadas](README.md): cada critério, cada número e o motivo dele.

- [Eficácia: o que foi entregue](#eficácia-o-que-foi-entregue)
- [Eficiência: o que custou entregar](#eficiência-o-que-custou-entregar)
- [Eliminatórias](#eliminatórias)
- [A nota da rodada](#a-nota-da-rodada)
- [Instruções e limites](#instruções-e-limites)
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
critérios avaliados. Uma dimensão sem nenhum critério avaliado fica sem nota.

## Eficácia: o que foi entregue

Eficácia é o agente ter feito o que o prompt pediu, dentro das permissões que a política dá. A nota é a média destes
critérios:

| Critério                 | Como é medido                                                                                                                                                                       | Nota                                                             | Quando não é avaliado                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| **Instruções do prompt** | as instruções conferíveis do agente (`instructions`), checadas no workspace ao fim do passo dele: o arquivo existe e, se pedido, contém o trecho (sem diferenciar maiúsculas)       | `5 × cumpridas ÷ instruções`. Cumpriu 2 de 3: 3,3                | nenhuma instrução declarada para o agente                 |
| **Permissões**           | não alterou nada fora do que a política libera para escrita (quando é `readOnly`) e não tentou destinos de rede que a política nega (os que o próprio provider bloqueia não contam) | alterou fora: 0; senão, começa em 5 e perde 1 por destino negado | o agente não tem política nem `readOnly`                  |
| **Referências corretas** | cada `arquivo:linha` (ou `arquivo:início-fim`) que ele citou existe no workspace como estava no início da rodada (a tag de partida), e a linha está dentro do arquivo               | `5 × válidas ÷ citadas`                                          | sem ponto de partida no git, ou nenhuma referência citada |
| **Limite de tempo**      | o tempo gasto pelo agente (a soma dos seus passos) contra o limite declarado (`limits.actorMs`)                                                                                     | dentro: 5; acima: 0. Estourar o prazo é não atingir a meta       | sem limite declarado                                      |

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
instruções, política nem referências), a eficiência fica sem nota, e a página mostra só a base.

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

A eficácia da rodada é a média das eficácias dos agentes avaliados, mais os limites da rodada, quando declarados
(`limits.roundMs`, o tempo decorrido, e `limits.costUsd`, o custo total: dentro dá 5, acima dá 0). A eficiência da
rodada é a média das eficiências dos agentes. A nota final da rodada usa a mesma conta da do agente: 60% da eficácia
da rodada mais 40% da média das bases de eficiência dos agentes. A página diz quantos agentes foram avaliados.

[↑ topo](#topo)

## Instruções e limites

As instruções são as partes do prompt que a rodada confere sozinha, sem interpretar texto. Escreva uma para cada pedido
do prompt que deixa (ou não deixa) algo no workspace, ao lado do prompt que a pede. O registro guarda só o veredito de
cada uma (o que foi conferido, se cumpriu e por quê), nunca o conteúdo do arquivo.

Uma instrução tem até três partes:

| Parte                  | O que é                                                                                                                         | Quando é conferida                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `check`                | o que tem que ser verdade: um arquivo (`file`), com um trecho (`contains`) ou não, ou `{ unchanged: true }`, "não alterou nada" | no fim do passo do agente                  |
| `when` (opcional)      | a condição para o `check` valer: um arquivo, com ou sem trecho                                                                  | no início do passo, antes de o agente agir |
| `otherwise` (opcional) | o que tem que ser verdade se a condição não valeu                                                                               | no fim do passo                            |

Sem `when`, o `check` vale sempre. Com `when` e sem `otherwise`, se a condição não valeu, a instrução não se aplica
e não conta. `otherwise` sem `when` é recusado.

```ts
export default defineRound({
  // …
  instructions: {
    // "Escreva um arquivo tickets/ticket-01.txt…"
    'product-owner': [{ check: { file: 'tickets/ticket-01.txt' } }],
    analista: [
      {
        // "O product owner entregou um ticket em tickets/ticket-01.txt"
        when: { file: 'tickets/ticket-01.txt' },
        // "…insira uma seção no arquivo com o título ANÁLISE TÉCNICA."
        check: { file: 'tickets/ticket-01.txt', contains: 'ANÁLISE TÉCNICA' },
        // "Se o arquivo não existir, feche a rodada": não alterou nada
        otherwise: { unchanged: true },
      },
    ],
  },
  limits: {
    roundMs: 600_000, // a rodada inteira, no relógio
    actorMs: { analista: 300_000 }, // cada agente, a soma dos seus passos
  },
});
```

- `file`: relativo à raiz do workspace.
- `contains`: um trecho, sem diferenciar maiúsculas.
- Um limite estourado dá 0 naquele critério da eficácia. Escolha limites que o modelo consegue cumprir quando acerta:
  um limite apertado demais mede o modelo lento, não a entrega.

Um agente tem nota de eficácia, e com ela nota final, quando ao menos um critério de eficácia tem o que medir: as
instruções, a política (ou `readOnly`), as referências `arquivo:linha` (com `start`) ou o limite de tempo.

[↑ topo](#topo)

## Os números da rubrica

Ficam em [`src/rounds/constants.ts`](../../src/rounds/constants.ts) (`RUBRIC`), cada um com o motivo do valor:

| Número         | Valor     | O que é                                                 |
| -------------- | --------- | ------------------------------------------------------- |
| `best`         | 0,75      | até 75% da referência, nota 5                           |
| `worst`        | 2         | o dobro da referência, ou mais, nota 0                  |
| `wastePenalty` | 1         | pontos tirados do processo por desperdício              |
| `weights`      | 0,6 e 0,4 | pesos da eficácia e da base da eficiência na nota final |

Mudou um desses, ou um critério, suba `RUBRIC_VERSION` em `score.ts`.

[↑ topo](#topo)
