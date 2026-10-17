---
order: 0
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# Comandos

> Cada comando do choliba, com o uso, os exemplos, os detalhes e as opções, gerado do mesmo spec que produz o --help.

O comando é `choliba`, instalado na pasta de trabalho, em `node_modules/.bin/`, que não está no `PATH`. Rode-o com o
Bun na frente: `bun choliba <comando>`; as páginas omitem o `bun`. Prefira `bun` a `bunx`: sem o choliba instalado, o
`bunx` baixa do npm o que tiver esse nome e executa (veja Segurança). A raiz tem poucos
comandos. `run`, `new` e `list` são verbos: o tipo vem na palavra seguinte (`choliba run agent`, `choliba new
project`, `choliba list projects`) e está na página do verbo. Uma palavra que o choliba não conhece é erro, com a
sugestão do nome mais parecido (`comando desconhecido: chek. Você quis dizer "check"?`).

## Opções globais

| Opção          | Descrição                                                                    |
| -------------- | ---------------------------------------------------------------------------- |
| `-h`, `--help` | A ajuda da raiz ou do comando, terminando com o endereço da página dele aqui |
| `--version`    | A versão instalada (veja [`choliba version`](./version.md))                  |
| `--no-color`   | Saída sem cores                                                              |

A saída só tem cor num terminal. `--no-color`, `NO_COLOR=1`, `FORCE_COLOR=0`, `TERM=dumb` ou um pipe tiram a cor;
`FORCE_COLOR=1` força. Quais cores usar vem de `CHOL_COLORS` no `.env` (veja
[`.env` da pasta de trabalho](../referencia/env.md)) e, para o rótulo de um agente, do `agent.color` dele.

## Ticket e testes

| Comando                   | O que faz                   |
| ------------------------- | --------------------------- |
| [`choliba run`](./run.md) | Roda um agente ou os testes |

## Projetos

| Comando                       | O que faz                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`choliba new`](./new.md)     | Cria um projeto a partir do modelo                                                                    |
| [`choliba list`](./list.md)   | Lista os agentes, os projetos ou a configuração                                                       |
| [`choliba check`](./check.md) | Confere a pasta de trabalho: agentes (schemas, skills, MCPs) e projetos; com PROJETO, só esse projeto |

## Agentes, skills e MCPs

| Comando                   | O que faz                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`choliba add`](./add.md) | Instala um agente (com suas skills e MCPs), uma skill ou um MCP de uma pasta, repositório git ou pacote npm |

## Pasta de trabalho

| Comando                         | O que faz                                                           |
| ------------------------------- | ------------------------------------------------------------------- |
| [`choliba setup`](./setup.md)   | Liga o autocomplete no bash (roda sozinho ao instalar com --trust)  |
| [`choliba update`](./update.md) | Atualiza o choliba para a versão mais recente e mostra as novidades |
| [`choliba set`](./set.md)       | Grava uma chave da configuração no .env                             |
| [`choliba lint`](./lint.md)     | ESLint na pasta de trabalho, com a configuração que vem no choliba  |
| [`choliba format`](./format.md) | Prettier na pasta de trabalho: confere, ou corrige com --write      |

## Gerais

| Comando                                     | O que faz                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`choliba panel`](./panel.md)               | Abre o painel interativo do choliba no terminal.                                                            |
| [`choliba help`](./help.md)                 | Mostra a ajuda da raiz ou de um comando                                                                     |
| [`choliba version`](./version.md)           | Mostra a versão instalada                                                                                   |
| [`choliba terminal run`](./terminal-run.md) | Roda um processo e prefixa cada linha da saída com um rótulo, para um script ver o que o processo escreveu. |
