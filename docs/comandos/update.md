---
group: Pasta de trabalho
order: 7
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba update`

> Compara a versão instalada com a release mais recente e, havendo uma nova, baixa, confere o SHA-256, instala e mostra as novidades.

## Uso

```sh
choliba update [--check] [--force]
```

## Exemplos

Atualiza e mostra as novidades:

```sh
choliba update
```

Só mostra se há versão nova e as novidades, sem instalar:

```sh
choliba update --check
```

Troca um pacote local pela release:

```sh
choliba update --force
```

## Detalhes

Roda na pasta de trabalho: o pacote novo fica nela (`choliba-0.0.1-dev.N.tgz`, no lugar do anterior), é instalado
com `bun add --trust` (que roda o `choliba setup`) e o `package.json` passa a apontar para ele. Um pacote que não
confere com o SHA-256 da release não é instalado.

As novidades são as da [página de releases](https://github.com/choliba/choliba/releases) desde a versão instalada. Rodando do código-fonte
do choliba, o comando recusa: ali se atualiza com `git pull`.

Um pacote local (feito com `bun run chol:pack`, cuja versão não tem o número da release) pode ser mais novo que
a release: o comando para e só o troca pela release com `--force`, sem mostrar novidades.

## Opções

| Opção          | Descrição                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| `--check`      | Só confere: diz se há versão nova e as novidades, sem instalar            |
| `--force`      | Troca pela release também um pacote local, que pode ser mais novo que ela |
| `-h`, `--help` | Mostra esta ajuda                                                         |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
