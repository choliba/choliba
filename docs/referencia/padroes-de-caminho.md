# Padrões de caminho

> O formato único de toda busca do choliba, o do gitignore sobre o fnmatch do POSIX: o que achar (`pattern`) e o que pular (`ignore`).

Todo campo que escolhe arquivos por padrão segue estas regras. Hoje são o `pattern` e o `ignore` de `search_files` e
`read_files` no [`agent.yaml`](agent-yaml.md#steps). Quem compila e valida o padrão é o `compilePathPatterns` de
[`choliba/core`](core.md); as buscas só perguntam a ele se um caminho casa.

## A referência

O formato é o **PATTERN FORMAT do gitignore**: [git-scm.com/docs/gitignore](https://git-scm.com/docs/gitignore).
Cada trecho de um nome (`*`, `?`, `[...]`, `\`) segue o **fnmatch do POSIX**, com `FNM_PATHNAME` e sem
`FNM_PERIOD`: IEEE Std 1003.1, Shell and Utilities, seção 2.13
([fnmatch(3p)](https://www.man7.org/linux/man-pages/man3/fnmatch.3p.html)).

- `FNM_PATHNAME`: `*`, `?` e `[...]` nunca casam `/`.
- Sem `FNM_PERIOD`: `*` casa um nome que começa com ponto, como `.env`, assim como no git.

O caminho comparado é relativo à pasta da busca (cada uma de `dirs`, ou a pasta de cada bloco da lista em `source`),
com `/`. Maiúsculas e minúsculas contam.

## As regras

| Padrão          | Casa                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| `vendor`        | sem `/`: o nome em qualquer nível, arquivo ou pasta                               |
| `*.png`         | `*` é qualquer parte de um nome; `?` é um caractere                               |
| `/package.json` | com `/` no começo ou no meio: o caminho a partir da pasta da busca, só ali        |
| `docs/api`      | o mesmo: só `docs/api` na pasta da busca                                          |
| `tests/`        | `/` no fim: só pastas, em qualquer nível                                          |
| `**/*.php`      | `**/` no começo: em qualquer pasta                                                |
| `src/**`        | `/**` no fim: tudo dentro de `src`                                                |
| `a/**/b`        | `/**/` no meio: zero ou mais pastas entre `a` e `b`                               |
| `v[0-9]`        | `[...]` é um caractere da classe; `[!...]` ou `[^...]` nega; `[[:digit:]]` também |
| `\*.md`         | `\` faz o caractere seguinte valer como ele mesmo                                 |
| `!keep.log`     | `!` no começo tira de volta o que um padrão anterior pegou                        |

- **O último padrão que casa decide.** Em `['*.log', '!keep.log']`, `keep.log` fica de fora.
- **Uma pasta pega tudo abaixo dela.** Um `!` não tira de volta um arquivo de uma pasta que um padrão pegou: em
  `ignore: [lib, '!lib/a.php']`, `lib/a.php` continua pulado (o git faz o mesmo).
- **Espaços no fim saem**, a menos que escapados com `\`.
- **Fora do formato:** `**` que não está sozinho num nome vale como `*`.

## O que é recusado

Um padrão que o formato deixa ambíguo é erro na validação do `agent.yaml`, com o padrão e o motivo. Ele nunca é
lido como texto de outro jeito:

- vazio, ou só `/` ou `!`;
- começando com `#` (no formato é um comentário; escreva `\#`);
- `[` sem o `]` que o fecha, ou uma classe `[:nome:]` que não existe;
- `/` dentro de `[...]`, que nunca casaria;
- `\` no fim, sem o caractere que ela escapa;
- `//` ou um nome vazio no meio.

Expressão regular não é aceita. `\.png.*` não quer dizer "termina em `.png`": é um nome que começa com `.png.`.
Escreva `*.png`.

## O que sempre fica de fora

Toda busca soma ao `ignore` estes padrões: `node_modules`, `vendor`, `dist`, `build`, `.git` e `.cache`.
