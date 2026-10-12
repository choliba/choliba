---
group: Pasta de trabalho
order: 6
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba setup`

> Prepara a pasta de trabalho na instalação e liga o autocomplete do bash para comandos, opções, agentes e projetos.

## Uso

```sh
choliba setup
```

## Exemplos

Prepara a pasta de trabalho e liga o autocomplete:

```sh
choliba setup
```

## Detalhes

Roda sozinho na instalação (`bun add --trust`): prepara a pasta de trabalho (o que ele cria está em
[Primeiros passos](../primeiros-passos.md#choliba-setup)) e liga o autocomplete.

### Autocomplete

O Tab completa comandos, opções e nomes (agentes, projetos, tickets) em `bunx choliba`, `bun choliba` e
`bun chol:*`, no bash. Se o Tab não completar no terminal que já estava aberto, abra outro ou rode
`source ~/.bashrc`. O script fica em `~/.local/share/choliba/completion.bash`, carregado por um bloco do
`~/.bashrc` que começa com `# Autocomplete do choliba`; apague esse bloco para desligar.
