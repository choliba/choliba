---
group: Pasta de trabalho
order: 7
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba lint`

> Roda o ESLint na pasta de trabalho, com a configuração que o setup liga, e devolve o código de saída do ESLint.

## Uso

```sh
choliba lint [ESLINT_ARGS]
```

## Exemplos

Confere a pasta de trabalho:

```sh
choliba lint
```

Corrige o que dá para corrigir sozinho:

```sh
choliba lint --fix
```

## Detalhes

Roda o ESLint com a configuração que o `choliba setup` liga no `eslint.config.js` da pasta de trabalho (`choliba/eslint`). Todo argumento, `--help` inclusive, vai para o ESLint, e o código de saída é o dele.
