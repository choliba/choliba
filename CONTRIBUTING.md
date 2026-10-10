# Contribuindo

Perguntas, bugs e sugestões vão para as [issues](https://github.com/choliba/choliba/issues). Pull requests são bem-vindos, sempre para a branch
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

O site da documentação é gerado do `docs/` pelo [VitePress](https://vitepress.dev): `bun run docs:dev` o serve
localmente, com recarga a cada mudança, e `bun run docs:build` o gera em `docs/.vitepress/dist` (o CI faz o mesmo em
cada PR, então um link quebrado barra o merge). Uma página nova em `docs/` entra sozinha na barra lateral, na posição em que o
`docs/README.md` (o índice) a cita e com o título do `# ` dela. A home do site (hero e cards) fica em `docs/.vitepress/home.ts`: o `bun run docs:home`, que o
`docs:dev` e o `docs:build` chamam, a escreve em `docs/index.md`, ignorado pelo git, para o `docs/` do GitHub ter só
documentação. O `docs/README.md` é a primeira página da documentação, em `/indice`. As cores e o tema ficam em `docs/.vitepress/theme/`. O site público é <https://choliba.github.io/>: a cada push na `master`, `docs.yml` pede
ao repositório [`choliba.github.io`](https://github.com/choliba/choliba.github.io) que publique (via
`repository_dispatch`).

O release é o PR de `develop` para `master` (merge commit). O merge dispara o workflow `release-dev.yml`, que roda o
mesmo `chol:pack`, move a tag `v0.0.1-dev` para o novo commit e troca o `.tgz`, as notas e o título da pré-release (a
versão atual e a data). Cada build da release sai com a versão `0.0.1-dev.<N>`, N sendo a contagem dos merges de release
na `master` (um pré-lançamento [SemVer](https://semver.org/lang/pt-BR/) da base que está no `package.json`), e grava o
commit, que o `choliba --version` mostra como metadado de build (`0.0.1-dev.16+1a2b3c4`); o `.tgz` sobe com o nome fixo,
então o endereço de instalação não muda. As notas seguem o Keep a Changelog e o Common Changelog: as releases agrupadas
por dia, o dia mais recente aberto e cada dia anterior recolhido, cada release com a versão e o PR, os Destaques do PR
de release no topo, os commits agrupados por tipo e, dentro do tipo, por escopo, com o PR na frente, as quebras primeiro
e com a nota de migração, e o que é interno recolhido. `bun run release:notes` mostra como elas ficam.

## Padrões do projeto

Cada padrão está descrito num lugar só, quase sempre uma skill de [`.agents/skills/`](.agents/skills/), lida por
pessoas e pelos agentes que trabalham no código. Esta tabela só aponta para eles e diz o que confere cada um.

| Padrão                                                                                      | Referência                                                                                                         | Onde está descrito                                                                    | Conferido por                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| Commits, branches e pull requests                                                           | [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)                                       | [`git-workflow`](.agents/skills/git-workflow/SKILL.md)                                | hook `commit-msg`, CI                      |
| Planos de trabalho (nome, um plano por PR, commits estimados)                               | —                                                                                                                  | [`plans`](.agents/skills/plans/SKILL.md)                                              | revisão                                    |
| TypeScript estrito (sem `any`), ESLint com tipos, Prettier e `.editorconfig`                | [typescript-eslint](https://typescript-eslint.io), [Prettier](https://prettier.io)                                 | [`quality-gates`](.agents/skills/quality-gates/SKILL.md)                              | `bun run check`, `verify.sh`, CI           |
| Cobertura que só sobe                                                                       | —                                                                                                                  | [`coverage-ratchet`](.agents/skills/coverage-ratchet/SKILL.md)                        | `bun run test:cov`, CI                     |
| A casca (container, tabela de comandos, um `ShellModule` por pacote)                        | —                                                                                                                  | [`cli-shell`](.agents/skills/cli-shell/SKILL.md) e [ARCHITECTURE.md](ARCHITECTURE.md) | specs com `runShell`, guarda do Playwright |
| Estrutura do código (camadas, `index.ts` por pasta, nomes em kebab, um comando por arquivo) | [JS Boundaries](https://www.jsboundaries.dev)                                                                      | [`code-standard`](.agents/skills/code-standard/SKILL.md)                              | `bun run lint`                             |
| A linha de comando (stdout e stderr, códigos de saída, help em pt-BR, cor)                  | [Command Line Interface Guidelines](https://clig.dev)                                                              | [`cli-guidelines`](.agents/skills/cli-guidelines/SKILL.md)                            | revisão                                    |
| Desenho de código                                                                           | [Object Calisthenics](https://github.com/devdojo-it/workshop-object-calisthenics)                                  | [`object-calisthenics`](.agents/skills/object-calisthenics/SKILL.md)                  | revisão                                    |
| Pacote novo no monorepo                                                                     | [Bun workspaces](https://bun.com/guides/install/workspaces)                                                        | [`add-workspace-package`](.agents/skills/add-workspace-package/SKILL.md)              | `verify.sh`                                |
| Documentação (tipo de cada página, estilo, docs junto do código)                            | [Diátaxis](https://diataxis.fr), [Google](https://developers.google.com/style/highlights) e Microsoft style guides | [`documentation`](.agents/skills/documentation/SKILL.md)                              | revisão, agente `docs-updater`             |
