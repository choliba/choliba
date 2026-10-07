# CLI

| Comando                                      | O que faz                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `choliba agents COMMAND [OPTIONS] [TASK...]` | Roda um agente da pasta de trabalho (`.choliba/agents/<nome>/`)                                           |
| `choliba <agente>`                           | Atalho para `choliba agents <agente>`                                                                     |
| `choliba projects COMMAND [ARGS]`            | Cria e lista projetos e tickets em `CHOL_PROJECTS_DIR`                                                    |
| `choliba tests [PROJECT[:TICKET]] [OPTIONS]` | Roda os testes E2E dos projetos com o Playwright                                                          |
| `choliba install <origem> [OPTIONS]`         | Instala um agente (com suas skills e MCPs), uma skill ou um MCP numa pasta, repositório git ou pacote npm |
| `choliba setup`                              | Cria a pasta de trabalho e liga o autocomplete (roda sozinho ao instalar com `--trust`)                   |
| `choliba completion bash`                    | Imprime o script de autocomplete do bash                                                                  |

`choliba --help` (ou `choliba COMMAND --help`) lista o mesmo, sempre a partir do binário instalado.

`choliba --version` mostra a versão instalada no formato [SemVer](https://semver.org/lang/pt-BR/): a base da
pré-release, o número da release (a contagem das releases, que aparece no título de cada atualização nas notas) e,
como metadado de build, o commit, por exemplo `choliba 0.0.1-dev.16+1a2b3c4`. Rodando dos fontes ou de um `chol:pack` local, sai só a base (`0.0.1-dev`).

Cores: a saída só tem cor num terminal. `--no-color` (em qualquer comando), `NO_COLOR=1`, `FORCE_COLOR=0`, `TERM=dumb`
ou um pipe tiram a cor; `FORCE_COLOR=1` força. Quais cores usar vem de `CHOL_COLORS` no `.env` (veja
[`.env` da pasta de trabalho](env.md)) e, para o rótulo de um agente, do `agent.color` dele.

## Antes dos testes: a aplicação

`choliba tests` deixa a aplicação do projeto pronta antes de rodar o Playwright, pelo ambiente ativo do
`config.json` do projeto:

1. Roda cada comando de `envs[].setup` em `appDir`, em ordem (por exemplo, `["bun install"]`). Um que falha para
   a rodada: `a aplicação não ficou pronta: "<comando>" saiu com código N`. Numa rodada de vários tickets, o setup
   roda uma vez só.
2. Com `envs[].start`, sobe a aplicação em `appDir` se nada responde no `baseURL`, espera ela responder (até 3
   minutos) e a derruba no fim. O log do servidor sai junto com o dos testes. Uma aplicação que já está no ar, como
   a que você subiu, é usada como está. Se ela não sobe: `a aplicação não subiu (envs[].start): …`.
3. Roda os testes. Sem `start`, se a aplicação não está no ar, `--expect` falha com
   `a aplicação não respondeu no baseURL: …`.

Os dois campos são opcionais. Um projeto com `global-setup.ts`, como o `exemplo`, continua subindo a aplicação por
ele.

Os agentes nunca sobem, derrubam ou simulam a aplicação, nem mexem nas dependências instaladas dela: todo agente
rodado com `--project` recebe essa regra no prompt, e o choliba nega a ele escrever em `<appDir>/node_modules/`.

## Autocomplete

O `setup` já liga o autocomplete do bash: grava o script em `~/.local/share/choliba/completion.bash` e adiciona
uma linha ao `~/.bashrc` que o carrega. Para imprimir o script sem rodar o setup, use `choliba completion bash`.
