---
name: object-calisthenics
description: Aplica o Object Calisthenics — as 9 regras de restrição de Jeff Bay para um desenho OO/TS melhor (um nível de indentação por método, sem else, embrulhar primitivos, coleções de primeira classe, um ponto por linha, sem abreviações, entidades pequenas, no máximo duas variáveis de instância, sem getters/setters) — adaptadas ao estilo TypeScript deste repositório. Use ao escrever ou revisar lógica de domínio não trivial, quando uma função ou classe está difícil de seguir, ao refatorar por legibilidade ou testabilidade, ou quando perguntarem o que "object calisthenics" quer dizer aqui. Não é um gate do `bun run check`: é uma disciplina para aplicar de propósito, não uma regra de lint.
argument-hint: 'O arquivo ou a função a revisar ou refatorar; vazio para só ler as regras.'
user-invocable: true
disable-model-invocation: false
---

# Object Calisthenics

Nove regras do exercício original de Jeff Bay (via
[devdojo-it/workshop-object-calisthenics](https://github.com/devdojo-it/workshop-object-calisthenics)), reescritas
para o estilo real deste código: sobretudo funções, interfaces e módulos pequenos, não classes com estado de instância.
Elas existem para **treinar o julgamento**, não para passar sozinhas: nada aqui está ligado ao `bun run check` (o
`AGENTS.md` diz o que está). Aplique de propósito ao escrever ou revisar lógica que será lida e mudada com frequência;
não persiga as nove num script de uma linha.

## As 9 regras, adaptadas ao TypeScript

| # | Regra (original) | O que significa aqui |
| --- | --- | --- |
| 1 | Um nível de indentação por método | Um nível de aninhamento por função. Um segundo `if`/`for` dentro de um bloco pede uma função extraída ou um retorno antecipado: veja `validateCommandPattern` em `src/policy/command.ts`, que recusa cada caso inválido com um `throw` logo no começo. |
| 2 | Não use `else` | Cláusulas de guarda e `return`/`throw` antecipados em vez de cadeias `if/else`. Ternário para um valor só vale; um ternário que esconde um segundo ramo de lógica não. |
| 3 | Embrulhe todos os primitivos e strings | Um `string`/`number` solto que carrega significado (um padrão de comando, um caminho) vira um tipo com nome ou uma função que valida na borda, e não um primitivo nu passado por aí: `validateCommandPattern` e `validateWildmatch` (`src/policy`) validam o padrão uma vez, em vez de cada chamador confiar numa string crua. |
| 4 | Coleções de primeira classe | Um array com regras próprias (sem repetição, ordem, "não pode estar vazio") ganha uma função que é dona dessas regras, ao lado dele, em vez de cada chamador reimplementá-las com `.push`/`.sort` espalhados. |
| 5 | Um ponto por linha | Nada de cadeias `a.b.c.d` que alcançam o interior de outro objeto (Lei de Demeter). Um acesso por expressão; se você precisa do terceiro nível, falta um método no objeto do meio. |
| 6 | Não abrevie | `cholibaCacheDir`, não `cDir`; `compileFilesystemAccess`, não `cmpFsAcc`. O repositório já faz isso: mantenha, tanto em prosa em português quanto em identificadores em inglês. |
| 7 | Mantenha todas as entidades pequenas | Uma função que precisa de comentários para continuar legível é longa demais: divida. Como teto aproximado, uma função com mais de ~30 linhas ou um arquivo com mais de ~200 é um sinal para procurar uma emenda, não um limite a impor por máquina. |
| 8 | No máximo duas variáveis de instância por classe | Raro aqui, porque a maior parte da lógica é função ou módulo, não classe. Quando uma classe ou um objeto de configuração *acumula* campos, dois ou mais que variam juntos são o sinal de que ele deve virar dois colaboradores menores, em vez de um que faz dois trabalhos. |
| 9 | Sem getters/setters/propriedades | Diga, não pergunte. Prefira uma função que executa o comportamento a expor o estado cru para o chamador inspecionar e ramificar. Uma `interface` que só carrega dados (como as de `src/agent/types.ts`) vale: ela não esconde comportamento atrás de um acessor, ela *é* o dado. |

## Quando aplicar

- **Revisando um PR ou escrevendo lógica de domínio nova** (validação, parsing, qualquer coisa com ramificação de
  verdade): leia a função contra esta tabela antes de dá-la por pronta.
- **Uma função está difícil de seguir:** passe primeiro pelas regras 1, 2 e 7; elas pegam a maior parte da dor real.
- **Não** para scripts descartáveis, fixtures de teste ou código de cola cujo trabalho todo é chamar uma função de
  biblioteca.
- Um conflito com uma regra da casa perde para a regra da casa: as convenções do `AGENTS.md` e os gates do
  `bun run check` (sem `any`, TypeScript estrito, oxlint) valem mais que a redação do calisthenics.

## Relacionado

`AGENTS.md`: as regras do repositório e os gates do `bun run check`. Esta skill é um complemento, não uma sobreposição:
o calisthenics trata da *forma* (legibilidade, coesão); os gates tratam de *correção e tipagem*.
