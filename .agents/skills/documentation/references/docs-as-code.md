# Docs as code

Fonte: Write the Docs, <https://www.writethedocs.org/guide/docs-as-code/>. Trate a documentação como código-fonte:
texto simples no controle de versão, alterado pela mesma revisão, conferido automaticamente.

## Princípios

- **Mesmo repositório, mesma mudança.** O PR que muda o comportamento atualiza o texto que o descreve. Quem revisa
  confere os dois juntos, o único jeito confiável de manter os dois em sincronia.
- **Texto simples.** Markdown, legível no diff e no editor.
- **Uma fonte de verdade.** Um fato é escrito uma vez e ligado de todo lugar. Cópias se afastam.
- **Gere o que dá para gerar.** O `--help` da CLI, a lista de comandos, as páginas do site. Cópias à mão de fatos
  gerados envelhecem primeiro.
- **Apague sem dó.** Documentação velha é pior que nenhuma: o leitor confia. Quando um comportamento sai, o texto sai
  na mesma mudança.

## Esta mudança precisa de documentação?

Precisa:

- comandos, opções, chaves de configuração, variáveis de ambiente e padrões novos ou alterados;
- comportamento que quem usa observa (saída, códigos de saída, erros, arquivos escritos);
- passos de instalação, dependências ou requisitos novos;
- remoções e obsolescências (diga o que as substitui);
- uma decisão de desenho difícil de desfazer que os outros terão de aceitar (em geral um ADR).

Em geral não precisa:

- refatoração interna e renomeações invisíveis para quem usa;
- formatação, mudança só de teste e de ferramenta interna;
- correção que restaura o comportamento documentado (o texto já estava certo).

Na dúvida, pergunte se quem segue o texto atual agora seria enganado. Se sim, atualize.

## Verificações automáticas

Rode o que o projeto já roda:

| Verificação | O que pega | No Choliba |
| --- | --- | --- |
| Formatação | Markdown e tabelas inconsistentes | `bun run format:check` (Prettier) |
| Links | links internos quebrados e âncoras erradas | `bun run docs:build` (o VitePress recusa link morto) |
| Exemplos | comandos e trechos que não rodam mais | os exemplos de `guides/` rodam e passam pelo `bun run check` |
| Páginas geradas | `docs/guias/` e `docs/comandos.md` fora de dia com a fonte | `bun run docs:pages` antes do `docs:build` |

Se uma ferramenta ou agente não consegue rodá-las, ao menos deixe a saída num estado que o formatador aceita e
confira à mão cada caminho e âncora.

## Lista de revisão

- Cada página alterada ainda serve a uma necessidade do leitor (um tipo de Diátaxis por seção)?
- Cada comando, opção, caminho, padrão e exemplo foi conferido no código de agora?
- Todo link e âncora resolve? As páginas que citavam o comportamento removido foram atualizadas?
- Algo ficou duplicado que deveria ser um link?
- O README ainda põe quem chega para rodar?
