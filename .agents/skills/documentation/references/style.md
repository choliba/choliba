# Referência de estilo

Condensado do guia de estilo de documentação de desenvolvedores do Google
(<https://developers.google.com/style/highlights>) e do Microsoft Writing Style Guide
(<https://learn.microsoft.com/style-guide/top-10-tips-style-voice>). Quando o projeto tem guia próprio, o dele vale;
estas regras cobrem as lacunas.

## Voz e tom

- Conversa direta, nem casual nem formal: explique como a um colega capaz.
- Trate o leitor por "você". Voz ativa: o sujeito faz a ação ("a CLI grava o arquivo").
- Presente para como as coisas funcionam ("devolve", não "devolverá").
- Sem marketing nem exagero ("simplesmente", "apenas", "fácil", "poderoso"): não informam e fazem quem está
  travado se sentir mal.

## Estrutura

- A conclusão, o comando ou a resposta primeiro; o contexto depois.
- Títulos descrevem o conteúdo, sem ponto final. Os de tarefa começam por verbo ("Configure o provider"); os de
  conceito são substantivos ("Modelo de permissões").
- Parágrafos curtos (1 a 4 frases), um assunto cada.
- Lista numerada para sequência; com marcadores para itens sem ordem; tabela quando os itens têm vários atributos.
  Introduza uma lista com uma frase completa ou uma chamada clara.
- Todo passo é uma ação. Diga o resultado esperado quando ele não é óbvio.

## Palavras

- Prefira a palavra simples: "usar" a "utilizar", "para" a "a fim de".
- Defina um termo na primeira vez, depois use exatamente esse termo. Não alterne sinônimos para o mesmo conceito.
- Evite pronomes ambíguos ("isso", "ele") quando mais de uma coisa cabe.
- Escreva para um público amplo: sem gírias nem referências que não viajam.

## Código e elementos de tela

- Formato de código para comandos, opções, nomes de arquivo, caminhos, chaves, valores, variáveis de ambiente e texto
  de erro.
- Blocos de código com a linguagem. Mostre o comando e a saída relevante, aparada mas real.
- Marcadores explícitos e consistentes: `<projeto>`, `<ticket>`; explique-os logo depois do bloco.
- Comandos copiáveis: sem o caractere de prompt dentro do bloco, a menos que a saída esteja misturada.

## Links

- O texto do link diz para onde ele vai ("veja [permissões](permissoes.md)"), nunca "clique aqui".
- Ligue para a fonte única de um fato em vez de repeti-lo.
- Links relativos dentro do repositório, para funcionarem no editor, no GitHub e no site publicado.

## Acessibilidade

- Descreva imagens e diagramas em texto; não ponha informação essencial só numa imagem.
- Não dependa só de cor ou posição ("o botão vermelho", "a caixa à esquerda").

## Antes e depois

> ~~A fim de rodar os testes, o script `test` deve ser utilizado, o qual executará o Bun.~~
> Rode os testes com `bun run test`.

> ~~É possível configurar o provider por uma variável de ambiente, se desejado.~~
> Para escolher o provider, passe `provider: 'claude'` ou `'codex'` na configuração do agente.
