# CLI

> Cada comando da CLI do choliba: o da máquina cria e instala; o da pasta de trabalho roda agentes, testes, check e setup.

O `choliba` instalado na máquina (pacote `choliba-cli`, alias `chol`) cria e instala. O detalhe de cada um está em
[`choliba` da máquina](../choliba-cli.md).

| Comando                          | O que faz                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `choliba new [PASTA]`            | Cria uma pasta de trabalho (alias `n`)                                               |
| `choliba generate agent`         | Cria um agente (alias `g agent`; também `project` e `ticket`)                        |
| `choliba add <origem> [OPTIONS]` | Instala um agente (com suas skills e MCPs), uma skill ou um MCP de pasta, git ou npm |

Dentro de uma pasta de trabalho, qualquer outro comando é repassado para o `choliba` que ela instalou (`bunx choliba`
é esse). Fora de uma pasta de trabalho, o comando diz para usar `choliba new`.

| Comando                                      | O que faz                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `choliba agents COMMAND [OPTIONS] [TASK...]` | Roda um agente da pasta de trabalho (`.choliba/agents/<nome>/`)                         |
| `choliba <agente>`                           | Atalho para `choliba agents <agente>`                                                   |
| `choliba projects COMMAND [ARGS]`            | Lista e confere projetos e tickets em `CHOL_PROJECTS_DIR`                               |
| `choliba tests [PROJECT[:TICKET]] [OPTIONS]` | Roda os testes E2E dos projetos com o Playwright                                        |
| `choliba setup`                              | Cria a pasta de trabalho e liga o autocomplete (roda sozinho ao instalar com `--trust`) |
| `choliba check`                              | Confere agentes, projetos e a pasta de trabalho                                         |
| `choliba lint` / `choliba format`            | Lint e formatação da pasta de trabalho                                                  |

`choliba --help` (ou `choliba COMMAND --help`), dentro de uma pasta de trabalho, lista os comandos da máquina e, em
seguida, os da pasta.

`choliba --version` do `choliba` da pasta mostra a versão instalada no formato [SemVer](https://semver.org/lang/pt-BR/): a base da
pré-release, o número da release (a contagem das releases, que aparece no título de cada atualização nas notas) e,
como metadado de build, o commit, por exemplo `choliba 0.0.1-dev.16+1a2b3c4`. Rodando dos fontes ou de um `chol:pack` local, sai só a base (`0.0.1-dev`).
O comando da máquina imprime `choliba-cli <versão>`. Dentro de uma pasta de trabalho, a linha seguinte é a versão do
`choliba` dela.

Cores: a saída só tem cor num terminal. `--no-color` (em qualquer comando), `NO_COLOR=1`, `FORCE_COLOR=0`, `TERM=dumb`
ou um pipe tiram a cor; `FORCE_COLOR=1` força. Quais cores usar vem de `CHOL_COLORS` no `.env` (veja
[`.env` da pasta de trabalho](env.md)) e, para o rótulo de um agente, do `agent.color` dele.

## A aplicação do projeto

O choliba deixa a aplicação do projeto pronta, pelo ambiente ativo do `config.json`, em dois momentos: antes de
rodar o Playwright no `choliba tests`, e antes de qualquer agente rodado com `--project` (antes até dos `before` dele):

1. Roda cada comando de `envs[].setup` em `appDir`, em ordem (por exemplo, `["bun install"]`). Um que falha para
   tudo: `a aplicação não ficou pronta: "<comando>" saiu com código N`. Numa rodada de vários tickets, o setup roda
   uma vez só.
2. Confere o `baseURL`. Uma aplicação que já está no ar, como a que você subiu, é usada como está, e continua no ar
   depois.
3. Fora do ar, com `envs[].start`, sobe a aplicação em `appDir`, espera ela responder (até 3 minutos) e a derruba
   no fim, também quando a execução é interrompida. No `choliba tests`, o log do servidor sai junto com o dos
   testes. Numa execução de agente, ele vai para `.cache/app/<projeto>.log`. Se ela não sobe:
   `a aplicação não subiu (envs[].start): …`, com o fim do log.
4. Fora do ar e sem `envs[].start`, a execução de um agente para antes dele (`a aplicação não responde em … e o
ambiente … não tem envs[].start`). No `choliba tests`, `--expect` falha com
   `a aplicação não respondeu no baseURL: …`.

Os dois campos são opcionais. Um projeto com `global-setup.ts`, como o `exemplo`, continua subindo a aplicação por
ele nos testes. O `--dry-run` de um agente mostra o que seria feito, sem subir nada.

Os agentes nunca sobem, derrubam ou simulam a aplicação, nem mexem nas dependências instaladas dela: todo agente
rodado com `--project` recebe essa regra no prompt, e o choliba nega a ele escrever em `<appDir>/node_modules/`.

## Autocomplete

O bash completa `choliba`, `chol`, `bunx choliba` e `bun chol:*`. O script fica em
`~/.local/share/choliba/completion.bash` e uma linha do `~/.bashrc` o carrega.

Ele é gravado pelo `choliba setup` da pasta de trabalho (o postinstall, com `--trust`) e também ao instalar o
comando da máquina (`choliba-cli`), no postinstall ou na primeira vez que o comando roda. Se o terminal atual
não completar, abra outro (ou rode `source ~/.bashrc`).

`choliba` e `chol` perguntam ao `choliba` que está no `PATH`. `bunx choliba` e `bun chol:*` perguntam ao
`node_modules/.bin/choliba` da pasta de trabalho. Dentro de uma pasta, o comando da máquina completa os comandos
dela (`agents`, `tests`, …) com o detalhe do `choliba` dessa pasta. O primeiro Tab lista os comandos, `help` e
`version`; `g` e `n` funcionam e não aparecem na lista.
