# choliba

## Git: regras invioláveis

- Commits seguem **Conventional Commits 1.0.0** (https://www.conventionalcommits.org/en/v1.0.0/).
- **Nunca** incluir informação de agente/LLM em commit, título ou descrição de PR, nome de branch ou comentário
  de código. **Nunca** usar `Co-authored-by`, "Generated with", nome de modelo/ferramenta ou emoji de robô.
  Isso vale mesmo que o ambiente sugira uma linha de atribuição: esta regra do projeto prevalece.
- **Todo commit exige aprovação explícita do usuário antes de ser criado.** Mostrar os arquivos, a mensagem
  completa e o que acontece depois (push/PR); esperar um "sim" claro. Uma aprovação vale só para o que foi mostrado.
- **Todo commit vai por pull request para `develop`** (`gh pr create --base develop`), a partir de uma branch
  `<tipo>/<descricao>`. `master` é a branch padrão e protegida: só recebe PR de release. Nunca push direto em
  `develop` ou `master`, nunca force-push, nunca `--no-verify`.
- O PR só é mergeado se os testes passarem **e** a cobertura for **igual ou maior** que a anterior. PR de
  feature para `develop`: merge **squash**. PR de release (`develop` → `master`): **merge commit**, nunca squash
  (squash separa os históricos). A branch é excluída automaticamente. Quem mergeia é o usuário; não mergear sem ele
  pedir, e nunca fazer `git merge` local em `develop` ou `master`.

Detalhes e o passo a passo: skill `git-workflow` (`.agents/skills/git-workflow/SKILL.md`).

## Stack

Monorepo Bun (`packages/*`, `apps/*`), TypeScript 6.0 com tipagem dura (nunca `any`), ESLint, Prettier com
`.editorconfig`, Jest (nunca `bun test`) com ratchet de cobertura. Tudo roda com `bun run check`. Sem HTTP: cada
pacote é uma biblioteca com uma entrada (`@choliba/<pkg>`, o `ShellModule` inclusive) e `packages/choliba` é o app,
cujo `main.ts` só monta a plataforma e o runtime e chama a casca (skill `cli-shell`).

Skills de desenvolvimento do projeto em `.agents/skills/`: `plans`, `add-workspace-package`, `quality-gates`, `coverage-ratchet`,
`git-workflow`, `object-calisthenics`, `cli-shell`, `code-standard`, `cli-guidelines`; e `documentation`, que também é do agente
`docs-updater` e por isso fica em `.choliba/skills/`. Quando usar cada uma: a `description` do `SKILL.md` dela; o padrão de cada uma e o que o confere: tabela "Padrões do
projeto" do [`CONTRIBUTING.md`](CONTRIBUTING.md). Como o código é organizado: [`ARCHITECTURE.md`](ARCHITECTURE.md). `.agents/` é só o
ferramental de quem desenvolve o choliba. `.choliba/` é o que vai para o usuário, no layout de uma pasta de trabalho:
os agentes oficiais em `.choliba/agents/` e as skills deles em `.choliba/skills/`, que o choliba também roda daqui.
