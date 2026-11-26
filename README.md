# Choliba

![GitHub Created At](https://img.shields.io/github/created-at/choliba/choliba?color=bright-green&style=flat-square)
![GitHub contributors](https://img.shields.io/github/contributors/choliba/choliba?color=bright-green&style=flat-square)
[![license](https://img.shields.io/github/license/choliba/choliba.svg?color=bright-green&style=flat-square)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![cobertura](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/choliba/choliba/develop/.github/badges/coverage.json&style=flat-square)](COVERAGE.md)

Roda agentes de código (Claude Code, Codex, Cursor, Ollama) em sandbox, com uma política só e rodadas que os comparam.

Um agente junta um **provider** (qual CLI roda), um **workspace** (a sandbox onde ela roda), uma **política** (o que
ela pode fazer) e uma **conversa** (com quem ela fala: o terminal, uma tela cheia ou um arquivo). Cada peça é um
módulo próprio, com um curso em [`guides/`](guides/).

## Índice

- [Segurança](#segurança)
- [Contexto](#contexto)
- [Instalação](#instalação)
- [Uso](#uso)
- [API](#api)
- [Contribuir](#contribuir)
- [Licença](#licença)

## Segurança

O agente sempre roda isolado (bubblewrap ou Docker): não há modo sem sandbox. A política (`AgentPolicy`) vale igual
para todos os providers, e nada dela é aplicado pela metade: o que um provider não sabe aplicar é recusado ao criar
o agente. Comandos em aberto são perguntados a você, e o gate de execução falha fechado (sem resposta, nega).
Por padrão, cada raiz usa seu próprio home persistente dentro de `workspaces.homes` (`.choliba/homes`); só o arquivo de
login do provider entra nesse home e fica somente para leitura. Configure `hostState: 'none'` para não compartilhar
o arquivo de login (e fornecer uma credencial de ambiente), ou `hostState: 'share'` para compartilhar o estado do
host, gravável e com histórico de outros projetos. Um `Workspace` usado sozinho, sem agente, aplica o mesmo
isolamento: um home próprio, nenhum login e só as variáveis de sistema do ambiente. Nele, `hostState: 'share'` dá as
pastas de estado do host (`~/.config`, `~/.cache`…), graváveis, e o ambiente inteiro de quem o roda. Segredos não chegam
ao log. Veja os cursos de
[policy](guides/policy/README.md), [network](guides/network/README.md), [workspace](guides/workspace/README.md) e
[config](guides/config/README.md).

## Contexto

As CLIs de código são boas em trabalhar sozinhas, mas cada uma tem o seu jeito de rodar, de pedir permissão e de
mostrar o que faz. O Choliba dá a todas o mesmo contrato: o mesmo agente, a mesma política, a mesma conversa e o
mesmo log, trocando só o provider.

## Instalação

Precisa do [Bun](https://bun.sh), de Linux com `bwrap` e `nsenter` (para o workspace `bubblewrap`) ou do Docker, e
da CLI que o agente vai usar (`claude`, `codex`, `agent` ou o [Ollama](https://ollama.com)).

### Num projeto seu

O Choliba é um pacote Bun, distribuído pelas [releases](https://github.com/choliba/choliba/releases) do GitHub, não
pelo npm. Instale o `choliba-<versão>.tgz` da última release pelo endereço dele:

```bash
bun add https://github.com/choliba/choliba/releases/download/v<versão>/choliba-<versão>.tgz
```

Também dá para instalar direto do repositório (`bun add github:choliba/choliba`), mas assim o pacote chega sem as
páginas das rodadas, e o `choliba rounds:web` para, dizendo que elas não foram geradas.

A biblioteca vem de `choliba` (e `choliba/rounds`, `choliba/config`), e o comando `choliba` roda as rodadas, serve as
páginas, revisa as aprovações e limpa o que o Choliba guarda:

```bash
bunx choliba rounds <id>      # roda uma rodada declarada em rounds.definitions
bunx choliba rounds:web       # as páginas das rodadas, com os registros de rounds.data
bunx choliba approvals        # revisa os comandos negados pelo gate
bunx choliba clear            # apaga logs, workspaces, homes e rodadas
```

Cada comando lê o `choliba.config.ts` do projeto. O `rounds` e o `rounds:web` precisam de `rounds.definitions` (as
declarações) e `rounds.data` (os registros); uma rodada que parte de uma fixture precisa também de `rounds.fixtures`
(os pontos de partida) e `rounds.dir` (onde ela roda, fora do projeto). Sem elas, a config carrega igual, e só os
comandos das rodadas param, dizendo o que falta.

### No repositório do Choliba

Para contribuir, instale as dependências do projeto e as das páginas das rodadas, que o typecheck e o pacote usam:

```bash
bun install
bun install --cwd src/rounds/web
```

O `bun pm pack` gera o `choliba-<versão>.tgz`, já com as páginas das rodadas.

## Uso

```ts
import {
  Agent,
  ClaudeProvider,
  getConfig,
  runScript,
  Workspace,
} from 'choliba';

await runScript(async () => {
  await new Agent({
    name: 'analista',
    prompt: 'Analise o projeto.',
    provider: new ClaudeProvider({ model: 'claude-sonnet-5-5' }),
    workspace: new Workspace({
      type: 'bubblewrap',
      root: getConfig().workspaces.dir,
    }),
  }).run();
});
```

No terminal, **Ctrl+A** abre as aprovações, **Ctrl+C** para o agente e **Ctrl+D** encerra a conversa. O passo a passo,
com o `choliba.config.ts`, está nos [primeiros passos](https://choliba.github.io/primeiros-passos). Agentes com um
modelo de verdade estão no [curso do agente](guides/agent/README.md#7-agentes-de-verdade); no repositório do Choliba:

```bash
bun run ollama claude   # um agente num modelo local, pela CLI do Claude Code
bun run tui codex       # o mesmo, em tela cheia, pela CLI do Codex
bun run approvals       # revisa e aprova comandos negados
```

A configuração do projeto fica em `choliba.config.ts` (log, banco, workspaces e seus homes isolados, variáveis de ambiente); veja o curso de
[config](guides/config/README.md).

## API

Cada módulo tem um curso em `guides/<modulo>/README.md`, com exemplos que rodam como estão:

| Curso                                       | Sobre                                                 |
| ------------------------------------------- | ----------------------------------------------------- |
| [agent](guides/agent/README.md)             | o agente: opções, turnos, sessões, parar, `subscribe` |
| [providers](guides/providers/README.md)     | as CLIs: comandos, eventos, permissões                |
| [policy](guides/policy/README.md)           | a política: regras, decisões, aprovações              |
| [network](guides/network/README.md)         | a rede da sandbox                                     |
| [mcp](guides/mcp/README.md)                 | as ferramentas do projeto para os agentes             |
| [workspace](guides/workspace/README.md)     | a sandbox: bubblewrap e Docker                        |
| [interaction](guides/interaction/README.md) | a conversa                                            |
| [adapters](guides/adapters/README.md)       | as formas de conversar: stdio e arquivo JSONL         |
| [tui](guides/tui/README.md)                 | a conversa em tela cheia                              |
| [input](guides/input/README.md)             | o stdin                                               |
| [output](guides/output/README.md)           | a saída                                               |
| [execute](guides/execute/README.md)         | rodar programas                                       |
| [filesystem](guides/filesystem/README.md)   | disco e caminhos                                      |
| [events](guides/events/README.md)           | eventos dentro do processo                            |
| [rounds](guides/rounds/README.md)           | as rodadas: comparar agentes com fatos                |
| [context](guides/context/README.md)         | quem está rodando                                     |
| [config](guides/config/README.md)           | o `choliba.config.ts`                                 |
| [command](guides/command/README.md)         | comandos de linha de comando                          |
| [cli](guides/cli/README.md)                 | os comandos do Choliba                                |

## Contribuir

As regras do projeto, para pessoas e agentes, estão no [AGENTS.md](AGENTS.md). Antes de entregar,
`bun run check` (typecheck, lint, formatação e testes) precisa passar.

Ao editar este arquivo, siga a especificação do [standard-readme](https://github.com/RichardLitt/standard-readme).

## Licença

[MIT](LICENSE).
