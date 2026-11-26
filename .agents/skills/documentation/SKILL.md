---
name: documentation
description: Práticas para escrever e manter documentação técnica — decidir que tipo de texto o leitor precisa (Diátaxis: tutorial, guia prático, referência, explicação), onde ele mora, como escrever (estilo Google/Microsoft), como mantê-lo verdadeiro em relação ao código (docs as code), README, ADR, changelog e o que os agentes leem (AGENTS.md). No Choliba, a documentação é o curso de cada módulo em guides/ e o site https://choliba.github.io/ (docs/, VitePress). Use ao escrever, atualizar, reestruturar ou revisar docs, README, um guia, um changelog, um ADR ou o AGENTS.md, ao documentar uma funcionalidade depois de implementá-la, ou ao decidir se uma mudança precisa de documentação — mesmo que o pedido diga só "atualize a documentação" ou "explique isso no README".
argument-hint: 'O que mudou, ou a página a escrever ou revisar.'
user-invocable: true
disable-model-invocation: false
---

# Documentação

Boa documentação responde à necessidade de um leitor, no lugar onde ele vai procurar, com fatos que valem para o
código de hoje. Quase toda falha de documentação é uma destas três: o tipo de texto errado para a necessidade (um
tutorial que vira despejo de referência), o texto certo no lugar errado (uma página nova que ninguém acha enquanto a
antiga envelhece) ou o texto que se afastou do código. O roteiro abaixo existe para evitar cada uma.

## Onde a documentação do Choliba mora

| Lugar | O que é | Quem escreve |
| --- | --- | --- |
| `guides/<modulo>/README.md` | o curso do módulo, com exemplos completos em `guides/<modulo>/exemplos/` que rodam como estão e passam pelo `bun run check` | à mão, seguindo a skill [`guias-exemplos-completos`](../guias-exemplos-completos/SKILL.md) |
| `README.md` | a porta de entrada: o que é, como instalar e rodar em minutos, para onde ir | à mão |
| `docs/` | o site https://choliba.github.io/ (VitePress). `docs/index.md`, `docs/primeiros-passos.md` e a ordem do menu são à mão; as páginas dos cursos (`docs/guias/`) e a dos comandos (`docs/comandos.md`) são **geradas** por `bun run docs:pages` a partir de `guides/` e da tabela de comandos (`src/cli/commands.ts`) | à mão e por script |
| `AGENTS.md` e `.agents/skills/` | o que agentes e pessoas leem antes de mexer no código | à mão |

O site publica o que está em `guides/`: **uma mudança no curso é uma mudança no site**, não há texto para copiar. Não
edite à mão as páginas geradas (`docs/guias/`, `docs/comandos.md`); mude a fonte e rode `bun run docs:pages`. O
`bun run docs:build` roda no CI de todo PR, então um link quebrado ou uma página velha reprova o PR, não só o site.

O build também escreve o que os buscadores e os links compartilhados leem (`scripts/docs-seo.ts`, ligado em
`docs/.vitepress/config.ts`): `sitemap.xml`, `robots.txt`, o Google Analytics (só nas páginas buildadas), o arquivo de
verificação do Search Console (`docs/public/google*.html`, que não se reformata), o cartão de compartilhamento de cada
página (`og:*`, `twitter:card`, `canonical`) e a `<meta name="description">`, que é a citação (`> …`) logo abaixo do
título da página. A imagem do cartão é `docs/public/og-choliba.png`, gerada do `docs/.vitepress/og-image.svg` (o comando
`inkscape` está no comentário do SVG); mude o SVG e gere o PNG de novo.

## Roteiro

1. **Comece pela mudança, não pelos documentos.** Identifique o que mudou para quem usa o projeto: um comando, uma
   opção, uma chave de configuração, um padrão, um comportamento, um modo de falha. Refatoração interna, renomeação
   que ninguém vê, formatação e mudança só de teste costumam não precisar de texto: diga isso, em vez de inventar.
2. **Nomeie o leitor e a necessidade**, depois escolha o tipo de documento (abaixo). Uma página serve uma necessidade.
3. **Ache onde o texto mora antes de criar qualquer coisa.** Leia os documentos e a estrutura. Prefira atualizar a
   página que já cobre o assunto a criar outra; uma página nova só se o assunto é novo *e* nenhuma existente serve.
   Mantenha os nomes de arquivo, os títulos e a ordem.
4. **Confira cada afirmação na fonte de verdade**: o código, o `--help` real do comando, o diff. Nunca descreva um
   comportamento de memória, de um plano ou de como ele "provavelmente" funciona. O que não dá para conferir sai do
   texto ou vira pergunta em aberto.
5. **Escreva** seguindo o estilo abaixo, em português, a língua dos cursos.
6. **Confira** o que o projeto confere: `bun run format:check`, `bun run docs:build` (links e páginas) e os exemplos
   (`bun run check`). Todo link, caminho, comando e exemplo precisa ainda existir.
7. **Relate** o que mudou, onde e por quê, e o que você decidiu deliberadamente não documentar.

## Que tipo de documento (Diátaxis)

| O leitor quer... | Tipo | Escreva como |
| --- | --- | --- |
| aprender fazendo, do zero | Tutorial | uma lição com um caminho seguro até um resultado visível; sem escolhas nem desvios |
| resolver uma tarefa | Guia prático | passos numerados até um objetivo, para quem já sabe o básico; começa pelo objetivo |
| consultar um fato exato | Referência | completa, exata e neutra; com a forma da coisa que descreve |
| entender o porquê | Explicação | contexto, decisões de desenho, trocas, alternativas |

O erro mais comum é misturar tipos numa página. Quando uma página precisa de dois, separe e ligue as duas. Detalhes e
sintomas de cada tipo: `references/diataxis.md`. O curso de um módulo mistura os tipos de propósito (tutorial no
começo, referência no fim): o que importa é que cada *seção* tenha um tipo só.

## Estilo

Destilado dos guias de estilo de documentação de desenvolvedores do Google e da Microsoft:

- **Comece pelo que importa.** A primeira frase de uma página ou seção diz para que ela serve; a resposta vem antes do
  contexto.
- **Segunda pessoa, voz ativa, presente.** "Rode `bun run check`", não "o check deve ser rodado".
- **Curto e concreto.** Corte o que não informa; prefira um exemplo real a uma regra abstrata.
- **Uma ideia por frase, um assunto por parágrafo.** Listas para sequências e opções, tabelas para comparações com
  vários atributos.
- **Nomeie as coisas como o leitor as vê:** o comando, a opção, o caminho, a chave e a mensagem de erro de verdade, em
  código. Um nome por conceito em todas as páginas.
- **Exemplos reais que funcionam.** Copie comandos e saídas de execuções de verdade; nunca um marcador que parece real.
  Marque o que o leitor troca (`<projeto>`).
- **Títulos que descrevem o conteúdo**, para o índice se ler como um resumo.
- **Ligue em vez de repetir.** Um fato mora num lugar só; as outras páginas apontam para ele.

Mais regras e exemplos: `references/style.md`.

## Mantendo o texto verdadeiro (docs as code)

- A documentação mora no repositório, em texto simples, ao lado do código que descreve.
- Uma mudança que afeta quem usa atualiza o texto **na mesma mudança**, revisada junto com o código. Texto escrito
  "depois" é texto que se afasta.
- Automatize o que dá para conferir: formatação, links quebrados, exemplos que rodam (os de `guides/` rodam no `check`).
- Remova ou reescreva o que deixou de ser verdade. Texto velho é pior que texto nenhum, porque o leitor confia nele.
- O que dá para gerar se gera: o `--help` de cada comando sai da declaração dele (`defineCommand`), a lista de
  comandos sai de `src/cli/commands.ts`, e as páginas dos cursos saem de `guides/`.

Verificações e ferramentas: `references/docs-as-code.md`.

## Documentos especiais

- **README**: a porta de entrada. O que o projeto é, para quem, como instalar e rodar em minutos, para onde ir. Ligue
  para os cursos em vez de duplicá-los.
- **ADR** (registro de decisão de arquitetura): uma decisão grande e difícil de desfazer por registro: contexto,
  decisão, consequências. Registro aceito não se edita; um novo o substitui.
- **Changelog**: para pessoas, por versão, do mais novo ao mais antigo, com data e tipo (Adicionado, Alterado,
  Obsoleto, Removido, Corrigido, Segurança). No Choliba as notas da release são geradas do git (skill `git-workflow`).
- **O que os agentes leem** (`AGENTS.md`, as skills): Markdown curto e estruturado, com comandos e caminhos exatos;
  cresce só quando um agente erra a mesma coisa de novo.

Modelos de cada um: `references/special-documents.md`.
