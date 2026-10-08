# `choliba` da máquina

> O `choliba` da máquina cria a pasta de trabalho, gera agentes, projetos e tickets e instala agentes, skills e MCPs.

Você instala esse comando uma vez, na máquina. Ele responde pelo nome `choliba` e pelo alias `chol`:

- **`choliba new`** (alias `n`): prepara uma pasta de trabalho do zero;
- **`choliba generate`** (alias `g`): cria um agente, um projeto de teste ou um ticket;
- **`choliba add`**: instala um agente (com as skills e os MCPs que ele declara), uma skill ou um MCP.

Cada um desses pergunta, no terminal, o que não vier nas opções. Com `--no-input` (ou fora de um terminal), não
pergunta nada: usa as opções e os padrões, e falha dizendo qual opção falta quando um valor não tem padrão.

Dentro de uma pasta de trabalho, qualquer outro comando (`agents`, `tests`, `check`, o atalho `choliba <agente>`)
é repassado para o `choliba` que aquela pasta instalou, na versão dela. Fora de uma pasta de trabalho, esse comando
diz para criar uma com `choliba new`. Os agentes continuam chamando `bunx choliba`, que é o da pasta.

## Instalação

O pacote é o `choliba-cli-0.0.1-dev.tgz` da pré-release
[`v0.0.1-dev`](https://github.com/choliba/choliba/releases/tag/v0.0.1-dev), a mesma do choliba. Precisa do
[Bun](https://bun.sh):

```sh
bun add -g https://github.com/choliba/choliba/releases/download/v0.0.1-dev/choliba-cli-0.0.1-dev.tgz
```

Os comandos que isso coloca no `PATH` são `choliba` e `chol`. Para conferir a versão:

```
$ choliba --version
choliba-cli 0.0.1-dev.25+516f9c1
```

Dentro de uma pasta de trabalho, a mesma opção mostra as duas versões: a do comando da máquina e a do `choliba`
instalado na pasta. `chol --version` é o mesmo que `choliba --version`.

Para atualizar, remova e instale de novo (a URL não muda a cada versão): `bun remove -g choliba-cli` e o
`bun add -g` acima.

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

Dentro de uma pasta de trabalho:

```sh
choliba generate project minha-app --app-dir ../minha-app --base-url http://localhost:3000
```

Copia o template para `CHOL_PROJECTS_DIR`. `--app-dir` é obrigatório e precisa ser uma pasta; um caminho relativo
conta a partir da pasta em que você rodou o comando. Sem o nome, o projeto leva o nome dessa pasta. O título e o
primeiro parágrafo do README na raiz dela viram o `description`. `--base-url` preenche o `baseURL` dos ambientes.

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
