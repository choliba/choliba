---
group: Projetos
order: 3
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba list`

> Lista os agentes da pasta de trabalho, os projetos com os tickets quando se pede, ou a configuração em vigor e de onde vem cada valor.

## Uso

```sh
choliba list TYPE [ARGS]
```

## Exemplos

Lista os agentes instalados:

```sh
choliba list agents
```

Mostra a configuração em vigor e de onde vem cada valor:

```sh
choliba list config
```

Lista os projetos com os tickets de cada um:

```sh
choliba list projects --tickets
```

## `agents`

Lista os agentes da pasta de trabalho, cada um com o id, a versão, os modelos, as skills, os modos e a política.

### Uso

```sh
choliba list agents [OPTIONS]
```

### Exemplos

Lista os agentes da pasta de trabalho:

```sh
choliba list agents
```

Lista os agentes de outra pasta:

```sh
choliba list agents --agents-dir ./agentes
```

### Detalhes

Cada agente sai com o bloco que o `--help` dele mostra: id, nome, versão, descrição, modelos, skills, modos e a política. Os agentes ficam em `.choliba/agents/` (ou em `CHOL_AGENTS_DIR`); veja [Instalar agentes, skills e MCPs](../guias/instalar-agentes.md).

### Opções

| Opção                | Descrição                                    |
| -------------------- | -------------------------------------------- |
| `--agents-dir <dir>` | Pasta dos agentes (padrão: .choliba/agents/) |
| `-h`, `--help`       | Mostra esta ajuda                            |

## `projects`

Lista os projetos da pasta configurada em CHOL_PROJECTS_DIR e, com --tickets, os tickets de cada um.

### Uso

```sh
choliba list projects [OPTIONS]
```

### Exemplos

Lista os projetos, com a descrição de cada um:

```sh
choliba list projects
```

Lista os projetos com os tickets de cada um:

```sh
choliba list projects --tickets
```

### Detalhes

Com `--tickets`, cada projeto sai numa linha `projeto ["chave", …]`, o formato que o `product-owner` lê para conhecer os outros tickets do projeto.

### Opções

| Opção          | Descrição                                |
| -------------- | ---------------------------------------- |
| `--tickets`    | Mostra também os tickets de cada projeto |
| `-h`, `--help` | Mostra esta ajuda                        |

## `config`

Lista a configuração em vigor na pasta de trabalho: cada chave, o valor e de onde ele vem.

### Uso

```sh
choliba list config [OPTIONS]
```

### Exemplos

Mostra cada chave com o valor e a origem:

```sh
choliba list config
```

O mesmo em JSON, para um script:

```sh
choliba list config --json
```

### Detalhes

A origem é `ambiente` (a variável do processo), `.env` (o da pasta de trabalho) ou `padrão` (o que o choliba usa sem nada definido); `não definida` quando nada vale. O ambiente vence o `.env`, que vence o padrão. Credenciais aparecem só como `definida` ou `não definida`, nunca o valor.

### Opções

| Opção          | Descrição                                   |
| -------------- | ------------------------------------------- |
| `--json`       | Saída em JSON: { CHAVE: { valor, origem } } |
| `-h`, `--help` | Mostra esta ajuda                           |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
