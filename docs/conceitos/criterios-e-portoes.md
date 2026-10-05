# Critérios de aceite e portões

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
