---
group: Pasta de trabalho
order: 8
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba set`

> Grava uma chave da configuração no .env da pasta de trabalho, uma por vez. Uma credencial é pedida sem aparecer na tela, ou lida do stdin.

## Uso

```sh
choliba set TYPE [ARGS]
```

## Exemplos

Roda o provider num container:

```sh
choliba set config CHOL_SANDBOX docker
```

## `config`

Grava uma chave da configuração no .env da pasta de trabalho.

### Uso

```sh
choliba set config CHAVE [VALOR]
```

### Exemplos

Roda o provider num container:

```sh
choliba set config CHOL_SANDBOX docker
```

Grava uma credencial, digitada sem aparecer na tela:

```sh
choliba set config CURSOR_API_KEY
```

Grava uma credencial vinda de outro comando:

```sh
echo "$CURSOR_API_KEY" | choliba set config CURSOR_API_KEY
```

### Detalhes

Uma chave por vez, das que `choliba list config` mostra; uma com lista de valores só aceita um deles. Uma credencial não vai na linha de comando, que fica no histórico do shell: sem VALOR, o choliba pede o valor sem mostrá-lo num terminal, ou o lê do stdin. O ambiente do processo vence o .env: o comando avisa quando ele define a chave com outro valor.

### Opções

| Opção          | Descrição         |
| -------------- | ----------------- |
| `-h`, `--help` | Mostra esta ajuda |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
