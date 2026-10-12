---
group: Projetos
order: 2
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba new`

> Cria um projeto de teste a partir do modelo. O tipo é project; o que faltar, como a pasta e a URL, é perguntado no terminal.

## Uso

```sh
choliba new TYPE [ARGS]
```

## Exemplos

Cria o projeto loja para a aplicação em ./app:

```sh
choliba new project loja --app-dir ./app
```

## `project`

Cria um projeto de teste a partir do modelo e pergunta no terminal o que faltar, como a pasta e a URL da aplicação.

### Uso

```sh
choliba new project [NOME] [OPTIONS]
```

### Exemplos

Cria o projeto loja para a aplicação em ./app:

```sh
choliba new project loja --app-dir ./app --base-url http://localhost:3000
```

Cria o projeto sem perguntar nada:

```sh
choliba new project loja --no-input
```

### Detalhes

Cria `projects/<nome>/` (em `CHOL_PROJECTS_DIR`) com `config.json`, `.env.example.json`, `tests/` e `tickets/`.
O nome sai da pasta da aplicação quando falta NOME, e o `description` vem do README dela. Num terminal, o que
faltar é perguntado; uma resposta vazia, ou `--no-input`, deixa o campo como `CHANGE_ME`. Depois, copie o
`.env.example.json` para `.env.json`, troque os `CHANGE_ME` e confira com `choliba check <nome>`. Os formatos estão em
[`config.json` do projeto](../referencia/config-json.md) e [`.env.json` do projeto](../referencia/env-json.md), e o
passo a passo em
[Do zero ao primeiro ticket](../guias/do-zero-ao-primeiro-ticket.md).

### Opções

| Opção               | Descrição                                                        |
| ------------------- | ---------------------------------------------------------------- |
| `--app-dir <pasta>` | Pasta da aplicação; o nome do projeto sai dela quando falta NOME |
| `--base-url <url>`  | URL base da aplicação                                            |
| `--no-input`        | Não pergunta nada: o que faltar fica CHANGE_ME                   |
| `-h`, `--help`      | Mostra esta ajuda                                                |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
