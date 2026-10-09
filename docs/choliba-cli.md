# choliba-cli

> O choliba-cli é a ferramenta de linha de comando que cria a pasta de trabalho, gera agentes, projetos e tickets e
> instala agentes, skills e MCPs.

O `choliba-cli` é instalado uma vez, na máquina. O comando que ele põe no `PATH` é `choliba` (alias `chol`). Com ele
você cria a pasta de trabalho e tudo o que vai dentro dela. Os agentes, os testes e o `check` rodam no `choliba` que
cada pasta de trabalho instala.

## Instalação

```sh
$ bun add -g https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-cli-0.0.1-dev.tgz
```

**Nota:** o choliba não está no npm. O pacote é o `.tgz` da pré-release
[`v0.0.1-dev`](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev), refeita a cada versão, com o mesmo
endereço. Precisa do [Bun](https://bun.sh).

**Dica:** `choliba --version` mostra a versão instalada; dentro de uma pasta de trabalho, mostra também a do
`choliba` da pasta. Para atualizar, remova e instale de novo: `bun remove -g choliba-cli` e o `bun add -g` acima.

```
$ choliba --version
choliba-cli 0.0.1-dev.25+516f9c1
```

## Fluxo básico

`choliba --help` lista os comandos, e `choliba COMMAND --help` mostra as opções de cada um:

```sh
$ choliba --help
$ choliba generate --help
```

Para começar, crie a pasta de trabalho, entre nela, crie o projeto de teste da sua aplicação e confira:

```sh
$ choliba new dev-tools
$ cd dev-tools
$ choliba generate project minha-app --app-dir ../minha-app --base-url http://localhost:3000
$ choliba check
```

O `choliba new` cria a pasta e o `package.json`, instala o choliba nela, grava o provider dos agentes no `.env`,
instala os agentes do choliba e roda o `check`. O passo a passo completo, até o primeiro ticket implementado, está
em [Primeiros passos](primeiros-passos.md#do-zero-ao-primeiro-ticket).

## Estrutura da pasta de trabalho

```
dev-tools/
├── .choliba/
│   ├── agents/       os agentes (um agent.yaml por pasta)
│   ├── skills/       as skills que os agentes usam
│   └── mcps/         os servidores MCP que os agentes usam
├── projects/         os projetos de teste, um por aplicação
├── app/exemplo/      uma aplicação de exemplo, com o projeto projects/exemplo/
├── .env              a configuração (provider, pastas, MCPs)
└── package.json      o choliba instalado, na versão desta pasta
```

O que cada parte faz e por quê: [A pasta de trabalho](conceitos/pasta-de-trabalho.md).

## Sintaxe dos comandos

```
choliba comandoOuAlias argumento [argumentoOpcional] [opções]
```

- `chol` é o mesmo que `choliba`; `n` é o alias de `new`, e `g` o de `generate`
  (`choliba g project` = `choliba generate project`).
- Cada comando pergunta, no terminal, o que não vier nas opções. Com `--no-input` (ou fora de um terminal), não
  pergunta nada: usa as opções e os padrões, e falha dizendo qual opção falta quando um valor não tem padrão.
- Dentro de uma pasta de trabalho, os outros comandos (`agents`, `tests`, `check`, `choliba <agente>`…) são
  repassados ao `choliba` que aquela pasta instalou, na versão dela. Fora de uma pasta, eles dizem para criar uma
  com `choliba new`. Os agentes chamam `bunx choliba`, que é o da pasta.

## Visão geral dos comandos

Do `choliba-cli`:

| Comando                        | Alias | Descrição                                                       |
| ------------------------------ | ----- | --------------------------------------------------------------- |
| `new [PASTA]`                  | `n`   | Cria uma pasta de trabalho do zero                              |
| `generate agent [NOME]`        | `g`   | Cria um agente novo na pasta de trabalho                        |
| `generate project [NOME]`      | `g`   | Cria um projeto de teste para uma aplicação                     |
| `generate ticket PROJETO TIPO` | `g`   | Cria o próximo ticket de um projeto                             |
| `add ORIGEM`                   |       | Instala um agente (com suas skills e MCPs), uma skill ou um MCP |

Da pasta de trabalho, repassados ao `choliba` dela (detalhes em [CLI](referencia/cli.md)):

| Comando              | Descrição                                       |
| -------------------- | ----------------------------------------------- |
| `agents`, `<agente>` | Roda um agente da pasta de trabalho             |
| `projects`           | Lista e confere projetos e tickets              |
| `tests`              | Roda os testes E2E dos projetos                 |
| `check`              | Confere a pasta de trabalho: agentes e projetos |
| `lint`, `format`     | ESLint e Prettier na pasta de trabalho          |
| `setup`              | Monta a pasta de trabalho e liga o autocomplete |

## Requisitos

- [Bun](https://bun.sh).
- Os navegadores do Playwright, uma vez por máquina: `bunx playwright install chromium`.
- Para rodar agentes, o CLI de um provider instalado e autenticado: `claude` (Claude Code) ou `cursor-agent`.

## Criar a pasta de trabalho: `choliba new`

```sh
choliba new minha-pasta
```

Em ordem, ele:

1. cria a pasta (que não pode existir com algo dentro) e o `package.json` dela;
2. instala o choliba com `bun add --trust`, e o [`choliba setup`](primeiros-passos.md#choliba-setup) monta o resto
   da pasta de trabalho;
3. grava no `.env` o provider dos agentes (`CHOL_AGENTS_PROVIDER`);
4. instala os agentes do choliba escolhidos (`product-owner`, `test-writer`, `implementer`) com `choliba add`. Com o
   `product-owner`, pergunta antes onde está o servidor do `mcp-app` e grava `CHOL_MCP_APP_DIR` e
   `CHOL_MCP_APP_LOG_DIR` (veja [o servidor do MCP `mcp-app`](guias/instalar-agentes.md#o-servidor-do-mcp-mcp-app));
5. pergunta se você quer criar um agente seu agora (o mesmo que o [`generate agent`](#criar-um-agente-choliba-generate-agent));
6. roda o `choliba check` e mostra os próximos passos.

Sem perguntas:

```sh
choliba new minha-pasta --provider claude --agents product-owner,test-writer --no-input
```

| Opção                    | O que faz                                                                 | Padrão                   |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------ |
| `PASTA`                  | A pasta a criar                                                           | `choliba`                |
| `--provider <provider>`  | Provider dos agentes: `auto` (o primeiro instalado), `claude` ou `cursor` | `auto`                   |
| `--agents <nomes>`       | Agentes do choliba a instalar, separados por vírgula                      | os três                  |
| `--no-agents`            | Não instala agentes                                                       |                          |
| `--mcp-app-dir <pasta>`  | Onde está o servidor `mcp-app`, para o `product-owner`                    | deixar para depois       |
| `--choliba <espec>`      | De onde instalar o choliba (o que o `bun add` aceita)                     | a release `v0.0.1-dev`   |
| `--agents-from <origem>` | De onde instalar os agentes (o que o `choliba add` aceita)                | `github:choliba/choliba` |
| `--no-input`             | Não pergunta nada                                                         |                          |

A saída de cada passo (`bun add`, `choliba add`) vai para o stderr; o stdout fica só com o resumo. Se um passo
falha, o comando para ali, diz qual foi e deixa a pasta como está. O código de saída é 1 quando um passo falha ou
quando o `check` aponta problemas.

## Criar um agente: `choliba generate agent`

Dentro de uma pasta de trabalho (ou de uma subpasta dela):

```sh
choliba generate agent revisor
```

Ele pergunta a descrição, o papel, os modelos, se o agente age sobre um projeto e o que pode fazer nele, e grava
`.choliba/agents/revisor/agent.yaml`. O arquivo já é válido no [schema](referencia/agent-yaml.md), com `CHANGE_ME`
onde você escreve o texto do agente: o que ele recebe (`input`), como trabalha (`flow`) e o que entrega
(`output`). Depois, roda o `choliba check`. Um agente que já existe nunca é tocado.

Sem perguntas:

```sh
choliba generate agent revisor --description "Revisa o código" --role "Você revisa código." \
  --project --access leitura --no-input
```

| Opção                   | O que faz                                                           | Padrão                  |
| ----------------------- | ------------------------------------------------------------------- | ----------------------- |
| `NOME`                  | O nome do agente, que é a pasta e o comando: `a-z`, `0-9`, `-`, `_` | perguntado              |
| `--description <texto>` | O que ele faz, numa frase (`agent.description`)                     | perguntado              |
| `--role <texto>`        | Quem ele é, numa frase (o começo do `role`)                         | perguntado              |
| `--models <modelos>`    | Modelos, separados por vírgula                                      | `claude-sonnet-5, Auto` |
| `--project`             | Age sobre um projeto: roda com `--project`                          | perguntado (sim)        |
| `--no-project`          | Não age sobre um projeto                                            |                         |
| `--access <acesso>`     | O que ele pode fazer no projeto (abaixo)                            | `leitura`               |
| `--no-input`            | Não pergunta nada                                                   |                         |

Com `--no-input`, o nome, a descrição e o papel são obrigatórios.

O acesso vira as [permissões](referencia/agent-yaml.md) do agente:

| Acesso    | Pode                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| `nada`    | nada no projeto: trabalha só com o que o prompt traz (o único acesso sem projeto) |
| `leitura` | ler a aplicação (`${APP_DIR}`) e os testes do projeto                             |
| `escrita` | também escrever na aplicação; a pasta do projeto continua fora da escrita         |
| `testes`  | também rodar os testes do projeto (`bunx choliba tests ${PROJECT}/tests`)         |

Depois de trocar os `CHANGE_ME`, veja o que o agente faria, sem rodar nada (veja [`--dry-run`](guias/dry-run.md)):

```sh
bunx choliba revisor --project minha-app --dry-run --show-prompt "revise a busca"
```

O que mais um agente pode declarar (skills, MCPs, passos antes e depois, modos): [Escrevendo um
agente](guias/escrever-um-agente.md).

## Criar um projeto: `choliba generate project`

Dentro de uma pasta de trabalho, sem nenhuma opção, o comando pergunta o que falta:

```sh
choliba generate project
```

Também dá para passar tudo de uma vez:

```sh
choliba generate project minha-app --app-dir ../minha-app --base-url http://localhost:3000
```

Copia o template para `CHOL_PROJECTS_DIR`. Um `--app-dir` relativo conta a partir da pasta em que você rodou o
comando; o valor guardado é absoluto. A pasta precisa existir. Sem o nome, o projeto leva o nome dessa pasta. O
título e o primeiro parágrafo do README na raiz dela viram o `description`. `--base-url` preenche o `baseURL` dos
ambientes; vazio não grava.

Quem já passou a opção não é perguntado de novo. Com só `--app-dir`, o nome sai da pasta e a URL fica de fora,
sem perguntas. Sem terminal, ou com `--no-input`, não pergunta: `--app-dir` é obrigatório, o nome sai da pasta e
a URL fica de fora.

| Opção              | O que faz                                     | Padrão                         |
| ------------------ | --------------------------------------------- | ------------------------------ |
| `PROJECT`          | Nome do projeto                               | o nome da pasta de `--app-dir` |
| `--app-dir <dir>`  | Pasta da aplicação                            | perguntado                     |
| `--base-url <url>` | URL base (`baseURL`); vazio não grava         | não grava                      |
| `--no-input`       | Não pergunta nada: usa as opções e os padrões |                                |

No terminal, quando falta `--app-dir`, as três são perguntadas (o nome e a URL já vêm com padrão: Enter aceita).
O comando não cria o `.env.json`. Ele diz para copiar o `.env.example.json` e trocar os `CHANGE_ME`.

## Criar um ticket: `choliba generate ticket`

```sh
choliba generate ticket minha-app story
```

Cria o próximo ticket do projeto a partir do template do tipo (`story`, `bug`, `improvement`, `task`), no ambiente
ativo do projeto. O projeto precisa estar pronto (`.env.json` criado, sem `CHANGE_ME`). O arquivo sai com `CHANGE_ME`
onde o texto do ticket ainda é seu.

## Instalar: `choliba add`

```sh
choliba add github:choliba/choliba --path .choliba/agents/product-owner
```

Instala na pasta de trabalho em que você está. O passo a passo, as origens (pasta, git, npm) e o `--dry-run` estão
em [Instalar agentes, skills e MCPs](guias/instalar-agentes.md).
