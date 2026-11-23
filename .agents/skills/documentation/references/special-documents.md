# Documentos especiais

## README

Fonte: a especificação Standard Readme, <https://github.com/RichardLitt/standard-readme> (`spec.md`).

O README é a porta de entrada. Quem chega deve saber em um minuto o que o projeto é, se é para ele e como pô-lo para
rodar. Salvo convenção própria, estruture pela Standard Readme: seções nesta ordem, as opcionais omitidas quando não
se aplicam, com os títulos traduzidos (`Instalação`, `Uso`, `Contribuindo`, `Licença`).

| Seção | Situação | Regras |
| --- | --- | --- |
| Título | obrigatória | Igual ao nome do repositório, da pasta e do pacote (ou explique a diferença na descrição longa). |
| Selos | opcional | Sem título; um por linha; cada um diz algo (CI, cobertura, release, licença). |
| Descrição curta | obrigatória | Sem título; uma linha, até 120 caracteres; o mesmo texto do `description` do pacote e do repositório. |
| Descrição longa | opcional | Sem título; por que o projeto existe e como as partes se encaixam, em poucos parágrafos. |
| Índice | obrigatória acima de 100 linhas | Links para cada seção de nível 2 depois dele. |
| Instalação | obrigatória | Um bloco de código; uma subseção de dependências para o que se instala à mão. |
| Uso | obrigatória | Um bloco de código do uso comum; uma subseção CLI quando há CLI. |
| Seções extras | opcional | Títulos próprios, entre Uso e API. |
| API | opcional | Funções e objetos exportados, ou um link para os cursos. |
| Contribuindo | obrigatória | Onde perguntar, se aceita PR, o que ele precisa cumprir; links para o CONTRIBUTING quando existir. |
| Licença | obrigatória, a última | Nome SPDX e dono; link para o arquivo da licença. |

O arquivo todo: Markdown válido, sem link quebrado (âncoras, arquivos locais e URLs), exemplos no estilo do projeto.
Quando uma mudança acrescenta uma seção, ponha-a no lugar certo da ordem e no índice.

Evite: ensaios de funcionalidades, referência duplicada, selos que não dizem nada, instruções que só funcionam na
máquina de quem escreveu.

## ADR (registro de decisão de arquitetura)

Fonte: Michael Nygard, "Documenting Architecture Decisions" (2011); <https://adr.github.io/>.

Escreva um quando a decisão é significativa para a arquitetura: afeta estrutura, características não funcionais,
dependências, interfaces ou técnicas de construção, e seria cara de desfazer.

```markdown
# <N>. <Título curto da decisão>

Data: <AAAA-MM-DD>

## Status

Proposta | Aceita | Substituída pela [ADR <M>](<arquivo>) | Obsoleta

## Contexto

As forças em jogo: o problema, as restrições, os requisitos e as opções, ditos com neutralidade.

## Decisão

O que decidimos, em voz ativa: "Vamos…".

## Consequências

O que fica mais fácil e mais difícil: o bom, o ruim e as trocas aceitas.
```

- Numere em sequência e mantenha juntos (`docs/adr/0001-<nome>.md`).
- Uma decisão por registro, curto o bastante para ler em poucos minutos.
- Aceita, não se reescreve. Quando a decisão muda, uma ADR nova a substitui e só a linha de status da antiga é
  alterada, com um link. A cadeia é a história.

## Changelog

Fonte: Keep a Changelog, <https://keepachangelog.com/pt-BR/1.0.0/>.

- Escrito para pessoas, não gerado das mensagens de commit cruas.
- A versão mais nova primeiro, cada uma com a data; uma seção `Não lançado` no topo.
- Mudanças por tipo: **Adicionado**, **Alterado**, **Obsoleto**, **Removido**, **Corrigido**, **Segurança**.
- Cada item diz o que mudou para quem usa, não como foi feito.
- Diga se o projeto segue o Versionamento Semântico; marque as quebras com clareza.

No Choliba as notas de cada release são geradas do git, dos títulos dos PRs (skill `git-workflow`): por isso o tipo e o
escopo do título importam.

## O que os agentes leem

Agentes de código e ferramentas leem a documentação do projeto direto (`AGENTS.md`, as skills de `.agents/skills/`).
Escreva para um leitor que segue instruções ao pé da letra e não lembra de nenhuma sessão anterior.

- **Curto e específico.** Comece pequeno e acrescente uma regra só quando um agente erra aquilo de novo; tire as que
  deixam de ser verdade. Arquivo de instruções longo e genérico atrapalha o agente.
- **Exato e executável:** comandos, caminhos e nomes de arquivo de verdade, não descrições deles.
- **Markdown estruturado:** títulos, listas e tabelas; um assunto por seção, para achar e citar a parte certa.
- **Diga o que não é óbvio:** as regras do projeto que diferem do padrão comum, e por quê.
- **Aponte, não copie:** ligue para os cursos ou skills detalhados em vez de duplicá-los.
