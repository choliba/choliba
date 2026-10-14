---
group: Pasta de trabalho
order: 9
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba format`

> Roda o Prettier na pasta de trabalho: confere a formatação, ou corrige com --write, e devolve o código de saída dele.

## Uso

```sh
choliba format [--write] [PATHS...]
```

## Exemplos

Confere a formatação da pasta de trabalho:

```sh
choliba format
```

Corrige a formatação:

```sh
choliba format --write
```

## Detalhes

Roda o Prettier com o `.prettierrc.json` e o `.editorconfig` da pasta de trabalho. Todo argumento, `--help` inclusive, vai para o Prettier, e o código de saída é o dele.

## Opções

| Opção     | Descrição                     |
| --------- | ----------------------------- |
| `--write` | Corrige em vez de só conferir |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
