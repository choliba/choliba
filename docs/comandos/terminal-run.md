---
group: Gerais
order: 14
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba terminal run`

> Roda um processo e prefixa cada linha da saída com um rótulo, para um script ver o que o processo escreveu.

## Uso

```sh
choliba terminal run --label <nome> [--timestamps] -- <comando...>
```

## Exemplos

Rotula a saída do servidor de desenvolvimento:

```sh
choliba terminal run --label app -- bun run dev
```

## Detalhes

Cada linha sai com o rótulo (`choliba terminal run --label demo -- echo ok` escreve `[demo] ok`), e o código de saída é o do processo. Não aparece no `choliba --help`: é para scripts.

## Opções

| Opção            | Descrição                        |
| ---------------- | -------------------------------- |
| `--label <nome>` | Rótulo que identifica cada linha |
| `--timestamps`   | Inclui o horário em cada linha   |
| `-h`, `--help`   | Mostra esta ajuda                |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
