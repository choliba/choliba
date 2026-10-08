# Critérios de aceite e portões

> Como os critérios de aceite em Gherkin viram testes E2E, os portões red e green que garantem o TDD e o que fazer
> quando um ticket substitui outro.

## Critérios de aceite

Cada critério do ticket (`criterios[]`) tem um `id` (`CA-01`, `CA-02`…) e uma `descricao` em Gherkin: uma lista de
frases, uma por passo. A primeira começa com `Dado`, depois vêm um `Quando` e um `Então`, nessa ordem; `E` e `Mas`
continuam qualquer um deles:

```json
{
  "id": "CA-01",
  "descricao": ["Dado que estou na página da loja", "E ainda não assinei a newsletter", "Quando informo meu e-mail e clico em Assinar", "Então vejo a mensagem \"Obrigado por assinar!\"", "Mas não recebo nenhum aviso de erro"],
  "testes": []
}
```

Não existe `Ou`: um resultado com "ou" são dois comportamentos, e cada um vira um critério. Uma execução que deixa um
critério fora desse formato (ou com `CHANGE_ME`) falha, dizendo qual frase corrigir.

## Portões dos testes de um ticket

`choliba tests PROJECT:TICKET --expect red|green [--failures ARQUIVO]` roda os testes de um ticket e confere o que
eles mostram. É assim que os agentes `test-writer` e `implementer` garantem o TDD:

- **`--expect red`**: todo critério do ticket tem teste, nenhum quebra no próprio código nem é pulado, e **pelo
  menos um falha pelo comportamento** (há o que implementar). Um critério cujos testes já passam fica como **já
  atendido**: o teste continua valendo como proteção contra regressão. Se todos passam, o portão recusa (nada a
  implementar).
- **`--expect green`**: todos os testes do ticket passam, inclusive os dos critérios já atendidos.
- **`--failures ARQUIVO`**: grava, em Markdown, os critérios a implementar com a falha de cada teste e, por último,
  os já atendidos. O `test-writer` grava esse arquivo no seu `steps.execute.after.success`, e o `implementer` o
  confere e o põe no prompt no seu `steps.<modo>.before` (veja [O que acontece numa execução](execucao.md)).

## Quando um ticket substitui outro

Um ticket novo pode tornar errado o que um ticket antigo pede: o antigo exige o link "Blog", o novo o tira. Os testes
do antigo continuam valendo como regressão, então quebrariam assim que o novo fosse implementado. O campo
`substitui` do ticket novo diz quais critérios ele aposenta:

```json
"substitui": ["minha-app-1:CA-03", "minha-app-1:CA-04"]
```

Cada item é `<ticket>:<critério>`, ou só `<ticket>` para todos os critérios dele. O ticket antigo não muda: fica como
histórico.

- **Os testes aposentados saem das rodadas do projeto** (`choliba tests minha-app`, `choliba tests minha-app/tests` e
  as rodadas dos agentes). Cada rodada começa dizendo o que ficou de fora:
  `aposentados: minha-app-1 CA-03, CA-04 (substituídos por minha-app-2)`. Um ticket com todos os critérios
  aposentados não roda no lote.
- **Rodar o ticket antigo sozinho** (`choliba tests minha-app:1`) ainda roda os testes dele, com um aviso. Com
  `--expect`, falha: não há o que conferir num critério substituído.
- **Uma referência inválida** (ticket ou critério que não existe, ou o próprio ticket) faz as rodadas do projeto
  falharem e o `choliba check` marcar o projeto com `✗`.

O `product-owner` lê os outros tickets do projeto e preenche o `substitui` quando a história nova troca um
comportamento que outro ticket descreve. O `implementer` para e avisa quando um teste de outro ticket contradiz o seu
sem estar em `substitui`.
