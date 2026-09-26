# choliba

Testes E2E multiprojeto com Playwright, operados por agentes.

## Instalação

```
bun add --trust choliba
```

O `--trust` deixa o Bun rodar o `postinstall` do pacote, que já executa `choliba setup` (veja abaixo). Sem
`--trust`, instale e rode o setup à mão:

```
bun add choliba
bunx choliba setup
```

## A pasta de trabalho

`choliba` roda sempre numa **pasta de trabalho**: a pasta, subindo a partir de onde o comando é chamado, cujo
`package.json` depende de `choliba` (é o que `bun add choliba` cria). É nela que ficam o `.env`, os agentes
(`agents/`), as skills (`.agents/skills/`) e os MCPs (`.agents/mcps/`) usados pelos comandos. Rodar `choliba` de
qualquer subpasta dela funciona do mesmo jeito.

## `choliba setup`

Roda sozinho no `postinstall` (com `--trust`) ou à mão (`bunx choliba setup`). Sem sobrescrever o que já existe,
ele:

- cria `agents/`, `.agents/skills/`, `.agents/mcps/` e `projects/` na pasta de trabalho;
- copia `.env.example` e `.gitignore` de um template, e cria o `.env` inicial com `GLOBAL_DIR` já apontando para
  a própria pasta de trabalho;
- lista `choliba` em `trustedDependencies` do `package.json`, para que instalações futuras rodem o setup de novo
  sem pedir `--trust`;
- liga o autocomplete do bash (veja abaixo).

## Comandos

| Comando                                      | O que faz                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `choliba agents COMMAND [OPTIONS] [TASK...]` | Roda um agente da pasta de trabalho (`agents/<nome>/`)                                                    |
| `choliba <agente>`                           | Atalho para `choliba agents <agente>`                                                                     |
| `choliba projects COMMAND [ARGS]`            | Cria e lista projetos e tickets em `PROJECTS_DIR`                                                         |
| `choliba tests [PROJECT[:TICKET]] [OPTIONS]` | Roda os testes E2E dos projetos com o Playwright                                                          |
| `choliba playwright-cli COMMAND [ARGS]`      | O navegador que os agentes usam (`playwright cli`)                                                        |
| `choliba install <origem> [OPTIONS]`         | Instala um agente (com suas skills e MCPs), uma skill ou um MCP numa pasta, repositório git ou pacote npm |
| `choliba setup`                              | Cria a pasta de trabalho e liga o autocomplete (roda sozinho ao instalar com `--trust`)                   |
| `choliba completion bash`                    | Imprime o script de autocomplete do bash                                                                  |

`choliba --help` (ou `choliba COMMAND --help`) lista o mesmo, sempre a partir do binário instalado.

## `choliba install`

Traz um agente (com as skills e os MCPs que ele declara), uma skill ou um MCP para a pasta de trabalho,
substituindo o que já estiver no destino:

```
choliba install <origem> [--path <item na origem>] [--dry-run]
```

- `<origem>` é uma pasta local, um repositório git (`https://…`, `git@…`, `github:dono/repo[#ref]`, ...) ou um
  pacote npm (nome ou `nome@versão`).
- `--path` escolhe o item dentro da origem (ex.: `--path agents/developer`), para origens com mais de um agente,
  skill ou MCP. Sem `--path`, a origem já precisa ser o item: uma pasta com `agent.yaml` ou `SKILL.md`, ou um
  arquivo `.json`.
- `--dry-run` mostra o que seria instalado, sem gravar nada.

Instalar um agente também traz as skills e os MCPs que ele declara, quando estão na origem; os que faltam saem
como aviso, para instalar à parte. Se o `.json` de um MCP usa uma variável (`${NOME}`) sem valor no `.env`, isso
também aparece como aviso.

## `.env` da pasta de trabalho

| Variável                    | Para quê                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GLOBAL_DIR`                | Raiz de onde os projetos são lidos (`GLOBAL_DIR/projects`), a menos que `PROJECTS_DIR` aponte para outro lugar. Preenchida pelo `setup` com a própria pasta de trabalho.      |
| `PROJECTS_DIR`              | Opcional: outro lugar para os projetos, no lugar de `GLOBAL_DIR/projects`.                                                                                                    |
| `TICKET_RUNS`               | Opcional: raiz de `ticket-runs/`, se não for `PROJECTS_DIR`.                                                                                                                  |
| `CHOL_AGENTS_PROVIDER`      | Provider padrão dos agentes (`auto`, `claude` ou `cursor`); um `--provider` na linha de comando ganha deste.                                                                  |
| `PLAYWRIGHT_MCP_OUTPUT_DIR` | Opcional: onde o `choliba playwright-cli` grava os arquivos que nomeia sozinho ou que recebem `--filename` relativo (snapshots, screenshots); padrão `.cache/playwright-cli`. |

## Autocomplete

O `setup` já liga o autocomplete do bash: grava o script em `~/.local/share/choliba/completion.bash` e adiciona
uma linha ao `~/.bashrc` que o carrega. Para imprimir o script sem rodar o setup, use `choliba completion bash`.

## Desenvolvendo este repositório

Este repositório é, ele mesmo, uma pasta de trabalho do choliba (`choliba` está no `package.json` da raiz como
`devDependency: workspace:*`). Para testar o pacote instalável sem publicá-lo, `bun run chol:pack` builda
`packages/choliba` e empacota o resultado num `.tgz` local (ignorado pelo git).
