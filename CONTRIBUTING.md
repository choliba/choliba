# Contribuindo

Perguntas, bugs e sugestões vão para as [issues](https://github.com/jacksonbicalho/choliba/issues). Pull requests são bem-vindos, sempre para a branch
`develop`, a partir de uma branch `<tipo>/<descrição>`, e seguindo as regras do projeto (detalhes em
[`AGENTS.md`](AGENTS.md) e na skill [`git-workflow`](.agents/skills/git-workflow/SKILL.md)):

- commits no [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/);
- `bun run check` verde (tipos, lint, formatação e testes) e cobertura igual ou maior que a do `develop`, o que o CI
  confere;
- nenhuma informação de agente ou LLM em commit, PR ou branch (sem `Co-authored-by`).

O `develop` só aceita merge squash; o release é um PR de `develop` para `master`, com merge commit.

## Desenvolvendo este repositório

Este repositório é, ele mesmo, uma pasta de trabalho do choliba (`choliba` está no `package.json` da raiz como
`devDependency: workspace:*`). Para testar o pacote instalável sem esperar um release, `bun run chol:pack`
builda `packages/choliba` e empacota o resultado num `.tgz` local (ignorado pelo git), que outra pasta de trabalho
instala pelo caminho do arquivo.

O release é o PR de `develop` para `master` (merge commit). O merge dispara o workflow `release-dev.yml`, que roda
o mesmo `chol:pack`, move a tag `v0.0.1-dev` para o novo commit e troca o `.tgz` e as notas da pré-release. As
notas trazem todas as releases, a mais nova primeiro, cada uma com os commits agrupados por tipo; `bun run
release:notes` mostra como elas ficam.

## Padrões do projeto

Cada padrão está descrito num lugar só, quase sempre uma skill de [`.agents/skills/`](.agents/skills/), lida por
pessoas e pelos agentes que trabalham no código. Esta tabela só aponta para eles e diz o que confere cada um.

| Padrão                                                                       | Referência                                                                                                         | Onde está descrito                                                              | Conferido por                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------- |
| Commits, branches e pull requests                                            | [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)                                       | [`git-workflow`](.agents/skills/git-workflow/SKILL.md)                          | hook `commit-msg`, CI                   |
| TypeScript estrito (sem `any`), ESLint com tipos, Prettier e `.editorconfig` | [typescript-eslint](https://typescript-eslint.io), [Prettier](https://prettier.io)                                 | [`quality-gates`](.agents/skills/quality-gates/SKILL.md)                        | `bun run check`, `verify.sh`, CI        |
| Cobertura que só sobe                                                        | —                                                                                                                  | [`coverage-ratchet`](.agents/skills/coverage-ratchet/SKILL.md)                  | `bun run test:cov`, CI                  |
| NestJS e nest-commander (módulos, entradas puras e `/nest`, `@Inject`)       | [NestJS](https://docs.nestjs.com), [nest-commander](https://nest-commander.jaymcdoniel.dev)                        | [`nestjs`](.agents/skills/nestjs/SKILL.md) e [ARCHITECTURE.md](ARCHITECTURE.md) | specs dos módulos, guarda do Playwright |
| A linha de comando (stdout e stderr, códigos de saída, help em pt-BR, cor)   | [Command Line Interface Guidelines](https://clig.dev)                                                              | [`cli-guidelines`](.agents/skills/cli-guidelines/SKILL.md)                      | revisão                                 |
| Desenho de código                                                            | [Object Calisthenics](https://github.com/devdojo-it/workshop-object-calisthenics)                                  | [`object-calisthenics`](.agents/skills/object-calisthenics/SKILL.md)            | revisão                                 |
| Pacote novo no monorepo                                                      | [Bun workspaces](https://bun.com/guides/install/workspaces)                                                        | [`add-workspace-package`](.agents/skills/add-workspace-package/SKILL.md)        | `verify.sh`                             |
| Documentação (tipo de cada página, estilo, docs junto do código)             | [Diátaxis](https://diataxis.fr), [Google](https://developers.google.com/style/highlights) e Microsoft style guides | [`documentation`](.choliba/skills/documentation/SKILL.md)                       | revisão, agente `docs-updater`          |
