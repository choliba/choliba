---
group: Agentes, skills e MCPs
order: 5
editLink: false
---

<!-- Gerado por `bun run docs:commands` a partir do spec do comando: não edite à mão. -->

# `choliba add`

> Instala um agente (com suas skills e MCPs), uma skill ou um MCP de uma pasta, repositório git ou pacote npm

## Uso

```sh
choliba add <origem> [OPTIONS]
```

## Exemplos

Instala o implementer do repositório do choliba, com as skills e os MCPs dele:

```sh
choliba add github:choliba/choliba --path .choliba/agents/implementer
```

Mostra o que instalaria de uma pasta, sem gravar:

```sh
choliba add ./meus-agentes --path agents/reviewer --dry-run
```

## Detalhes

Grava em `.choliba/agents/`, `.choliba/skills/` e `.choliba/mcps/` (ou nas pastas de `CHOL_AGENTS_DIR`, `CHOL_SKILLS_DIR` e `CHOL_MCPS_DIR`). As origens, os exemplos e o que o choliba oferece estão em [Instalar agentes, skills e MCPs](../guias/instalar-agentes.md).

## Opções

| Opção              | Descrição                                                |
| ------------------ | -------------------------------------------------------- |
| `--path <caminho>` | Item dentro da origem (ex.: .choliba/agents/test-writer) |
| `--dry-run`        | Mostra o que instalaria, sem gravar                      |

`--no-color` e `--version` valem em qualquer comando: veja [Comandos](./index.md#opções-globais).
