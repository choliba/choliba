---
group: Projetos
order: 4
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba check`

> Confere a pasta de trabalho: agentes (schemas, skills, MCPs) e projetos; com PROJETO, só esse projeto

## Uso

```sh
choliba check [PROJETO]
```

## Exemplos

Confere os agentes e os projetos da pasta de trabalho:

```sh
choliba check
```

Confere se o projeto loja está pronto para rodar:

```sh
choliba check loja
```

## Detalhes

Sem PROJETO, lista os agentes (schema, skills e MCPs de cada um) e os projetos, com `✓` ou `✗` e o que está errado embaixo; sai com 1 se algum está errado. Com PROJETO, confere os arquivos dele, o ambiente ativo e os `CHANGE_ME` que faltam trocar.

## Opções

| Opção          | Descrição         |
| -------------- | ----------------- |
| `-h`, `--help` | Mostra esta ajuda |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
