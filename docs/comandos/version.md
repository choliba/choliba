---
group: Gerais
order: 12
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba version`

> Mostra a versão instalada: a base da pré-release, o número da release e, quando houver, o commit do build.

## Uso

```sh
choliba version
```

## Exemplos

A versão instalada:

```sh
choliba --version
```

## Detalhes

A versão segue o [SemVer](https://semver.org/lang/pt-BR/): a base da pré-release, o número da release (a contagem das releases, que aparece no título de cada atualização nas notas) e, como metadado de build, o commit, por exemplo `choliba 0.0.1-dev.16+1a2b3c4`. Rodando dos fontes ou de um `chol:pack` local, sai só a base (`0.0.1-dev`).
