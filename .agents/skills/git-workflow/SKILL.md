---
name: git-workflow
description: Como commits, branches e pull requests funcionam no Choliba (Conventional Commits 1.0.0, aprovação obrigatória de quem usa o projeto antes de todo commit, toda mudança por um pull request na develop, merge só com o CI verde e a cobertura não menor que a de antes, nenhum rastro de agente de IA em commits ou PRs). Use sempre que pedirem para commitar, empurrar, criar branch, abrir ou mergear um pull request, escrever uma mensagem de commit ou um título de PR, fazer release para a master, ou perguntarem quais são as regras do git, e antes de rodar qualquer comando git que cria histórico.
argument-hint: 'O que você quer commitar, empurrar ou mergear.'
user-invocable: true
disable-model-invocation: false
---

# Fluxo do git

As regras abaixo vêm de quem é dono do projeto e não são negociáveis. Estão também no `AGENTS.md`, para valerem mesmo
quando esta skill não está carregada, e são cobradas por máquina: o hook `commit-msg` localmente e o workflow `CI` em
todo pull request. Leia esta skill para saber o como.

## 1. Nenhum rastro de agente de IA, nunca

Um commit, o título de um pull request, a descrição do PR, o nome de uma branch ou um comentário de código não podem
conter nenhuma informação sobre um agente ou modelo de linguagem: nada de rodapé `Co-authored-by` (de ninguém), de
"Generated with …", de nome de modelo, ferramenta ou fornecedor, nem emoji de robô. O autor do commit é a identidade
git de quem usa o projeto; nunca mude `user.name` nem `user.email`.

### `Co-authored-by` é proibido, sempre

**Nunca** ponha uma linha `Co-authored-by:` em lugar nenhum: nem na mensagem do commit, nem no corpo, nem na descrição
do PR, nem nos rodapés do merge por squash. A regra vale para **qualquer** coautor, não só agentes: o hook e o CI
recusam o próprio rodapé (veja `.githooks/forbidden-text`).

Algumas IDEs e ambientes de agente **injetam** um `Co-authored-by:` (de uma ferramenta de edição, por exemplo) quando
você roda um `git commit` simples. Essa injeção **não** é permitida aqui. Antes de empurrar:

1. Inspecione o commit: `git log -1 --format=full`. A saída deve mostrar **só** o autor e o committer de quem usa o
   projeto, e **nenhum** rodapé `Co-authored-by`.
2. Se o ambiente acrescentou um rodapé, crie o commit sem ele (por exemplo com `git commit-tree`, depois de o
   `.githooks/commit-msg` e o `.githooks/commit-identity` passarem num arquivo de mensagem limpo, como quando o hook
   local barra um rodapé injetado).

As mesmas regras de texto proibido valem para o **corpo do PR**. O CI roda `.githooks/commit-msg --no-format` na
descrição. Tire rodapés padrão como "Made with …" antes de abrir ou atualizar um PR: o hook e o CI os recusam. Evite
também, nos planos de teste, as palavras da lista `.githooks/forbidden-text` (nomes de produto de provider, por
exemplo): reescreva em vez de nomear o binário.

Alguns ambientes sugerem por padrão uma linha de atribuição para commits ou corpos de PR. Ignore a sugestão aqui: esta
regra é uma instrução explícita de quem usa o projeto e tem precedência. O `.githooks/commit-msg` recusa esse texto e o
CI confere todo commit, o título e o corpo do PR, então um deslize falha alto em vez de entrar no histórico.

## 2. Todo commit precisa antes da aprovação de quem usa o projeto

Nunca rode `git commit` (nem `--amend`) por conta própria. Antes de cada commit, mostre a quem usa:

1. os arquivos que serão commitados (`git status --short` e `git diff --cached --stat`),
2. a mensagem completa do commit, exatamente como será escrita,
3. o que acontece depois (empurrar qual branch, PR para qual base).

Depois espere um sim explícito. Uma aprovação cobre exatamente o que foi mostrado: se os arquivos ou a mensagem mudam,
pergunte de novo. Quando vários commits estão planejados, liste todos numa mensagem só para quem usa poder aprovar cada
um. Silêncio, ou a aprovação de um commit anterior, não é aprovação.

## 3. Conventional Commits 1.0.0

Formato: `<tipo>[escopo opcional][!]: <descrição>`, depois um corpo e rodapés opcionais, cada um separado por uma linha
em branco. Especificação: https://www.conventionalcommits.org/pt-br/v1.0.0/

| Tipo | Use para |
| --- | --- |
| `feat` | uma capacidade nova (SemVer minor) |
| `fix` | a correção de um bug (SemVer patch) |
| `refactor` | mudança de código que não corrige bug nem acrescenta capacidade |
| `perf` | uma melhoria de desempenho |
| `test` | acrescentar ou corrigir testes |
| `docs` | documentação, skills e `AGENTS.md` inclusive |
| `build` | sistema de build, dependências, `package.json`, lockfile |
| `ci` | workflows do GitHub e automação do repositório |
| `style` | só formatação, sem mudar o sentido |
| `chore` | manutenção que não cabe em nenhum acima |
| `revert` | desfaz um commit anterior |

- O **escopo** é o módulo ou a área, em minúsculas: `providers`, `agent`, `rounds`, `cli`, `ci`, `docs`, `skills`,
  `deps`.
- A **descrição**: no imperativo, começa em minúscula, sem ponto final, cabeçalho de no máximo 100 caracteres (mire em
  72). Diga o que mudou; use o corpo para o porquê.
- **Em português**, como o resto do projeto desde o #351: a descrição e o corpo do commit, e o título e o corpo do PR. O
  tipo e o escopo seguem a tabela e a lista acima (`feat(providers): acrescenta o toolOutput`).
- **Quebra de compatibilidade**: ponha `!` depois do tipo/escopo e um rodapé `BREAKING CHANGE: <o que quebra e como
  migrar>`. As notas da release citam esse rodapé sob a mudança como nota de migração, então escreva-o para quem
  atualiza; só o rodapé também marca o commit como quebra.
- **Uma mudança lógica por commit.** Não misture um refactor com uma funcionalidade; separe os commits.

## 4. Tudo chega à `develop` por um pull request

A `master` é a branch padrão e protegida: guarda o código lançado e só recebe PRs de release. A `develop` é a branch de
integração onde toda mudança entra primeiro. O GitHub abre PRs novos contra a branch padrão, então escolha sempre a
base de forma explícita: `gh pr create --base develop` (na web, troque a branch base para `develop`). Palavras-chave
como `Closes #12` só fecham uma issue quando o PR chega à `master`, isto é, na release; por isso o workflow
`close-issues.yml` as lê nos PRs para a `develop`. Nenhuma das duas branches aceita push direto, e o GitHub o recusa: um
ruleset em cada uma (veja a tabela abaixo) exige um PR, inclusive de quem é dono.

1. Parta de uma `develop` em dia: `git switch develop && git pull --ff-only`.
2. Crie uma branch chamada `<tipo>/<descrição-curta-em-kebab>` (`feat/tool-output`, `fix/ratchet-format`).
3. Trabalhe, rode `bun run check` localmente e obtenha a aprovação da seção 2 antes de cada commit.
4. Empurre a branch e abra o PR contra a `develop`: `gh pr create --base develop --title "<título convencional>"`.
   O commit de squash na `develop` é o que as notas da release usam. Com as configurações do repositório
   (`COMMIT_OR_PR_TITLE`, `COMMIT_MESSAGES`), um PR com **um commit** é espremido com o título e o corpo desse commit;
   com vários, o título é o do PR e o corpo lista os commits. Então tanto o commit quanto o título do PR seguem a seção
   3, e uma quebra de compatibilidade leva o rodapé no commit. Escreva o corpo do PR você mesmo, com `Closes #N` para a
   issue que ele resolve (skill `plans`); tire qualquer rodapé gerado por ferramenta e rode
   `.githooks/commit-msg --no-format` no corpo, localmente, na dúvida. Depois do `gh pr create`, confira com
   `gh pr view --json body`: alguns ambientes acrescentam atribuição depois da criação; edite o PR com `gh pr edit`.
5. Espere o CI (`gh pr checks --watch`). O GitHub mantém o botão de merge bloqueado até o `check` ficar verde. Na
   `develop` a branch não precisa estar em dia com a base: o squash cai sobre a `develop` atual, então mergear um PR não
   segura os outros.
6. Mergeie um PR de funcionalidade (na `develop`) por **squash**; a branch é apagada sozinha. Não mergeie por conta
   própria: diga a quem usa que o PR está verde e deixe que mergeie, ou mergeie só quando pedirem. Depois do merge,
   sincronize o repositório local: `git fetch --prune`, `git pull --ff-only` na `develop` e na `master`, volte à
   `develop` e rode `bun run git:clean` para apagar as branches locais já mergeadas.
7. Release: um PR da `develop` para a `master`, com as mesmas verificações, intitulado `chore(release): v<versão>`.
   Pergunte a quem usa se abre; nunca abra por conta própria depois de um merge. Veja abaixo.

### PRs de release usam merge commit, nunca squash

Um commit de squash na `master` não tem ascendência na `develop`, então as duas branches divergem: o próximo PR de
release lista commits que já tinham sido lançados e pode ter conflito, e um `git pull` local na `master` para com
"divergent branches". Os rulesets fixam o método por branch, então o diálogo de merge só oferece o certo:

- PR de funcionalidade para a `develop`: só **Squash and merge**,
- PR de release da `develop` para a `master`: só **Create a merge commit**.

Quando quem usa disser sim, o agente prepara e abre o PR de release (`gh pr create --base master --head develop`),
confirma que o CI está verde e para: quem usa mergeia. Depois desse merge, sincronize o repositório local como no passo
6. Um `git merge` local na `master` é recusado no push.

O corpo do PR de release tem, nesta ordem: `## Release v<versão>` (o que o merge faz com a release e que deve ser
mergeado com **Create a merge commit**); `## Destaques`, de uma a três frases em português para quem usa o Choliba,
dizendo o que muda para essa pessoa (o workflow de release copia esta seção para o topo da release, nas notas); e
`## O que entra`, cada título de squash da `develop` com uma explicação curta.

O PR de release sempre mostra "This branch is out-of-date with the base branch": os merge commits de release existem só
na `master`, e o ruleset da `master` exige a branch em dia. É esperado (quem usa escolheu, em 2026-10-06, manter o
ruleset), e atualizar a página costuma limpar o aviso. Nunca use "Update branch": ele faz merge da `master` na `develop`
sem um PR.

Até a versão 1.0, cada release é uma pré-release do GitHub com a tag `v<versão>`, onde `<versão>` é a `version` do
`package.json`, com o pacote como arquivo, `choliba-<versão>.tgz` (`bun pm pack`). O merge na `master`
roda `.github/workflows/release.yml`: monta o pacote e cria a release dessa tag ou, se ela já existe, troca o `.tgz` e
as notas e move a tag para o novo commit (`git push --force` da tag, a única exceção a "sem force-push", que é sobre
branches). As notas são refeitas do git a cada vez por `scripts/release-notes.ts` (`bun run release:notes` para
prever), no espírito do Keep a Changelog e do Common Changelog. Começam por como instalar e trazem todas as releases,
da mais nova à mais antiga: a mais nova aberta e as anteriores recolhidas, cada uma sob a sua data. Em cada release vêm
os `## Destaques` do PR de release e depois os commits dela, por tipo (Novidades, Correções, Alterações, Desempenho,
Documentação) e, dentro de um tipo, por escopo, cada item encabeçado pelo seu PR; as quebras (`**Breaking:**`)
primeiro, com o rodapé como nota de migração, e refactor, testes e manutenção recolhidos em "Interno". O tipo e o
escopo de um título de squash são o que o leitor vê ali, então uma mudança para quem usa nunca é tipada como `chore`
nem `ci`.

Nunca crie outra tag ou release à mão. A versão sobe à mão, no `package.json`, no PR que prepara a release (um aumento
SemVer: `0.1.0` para `0.1.1` em correções, `0.2.0` no que é novo, e assim por diante); o workflow registra nas notas o
commit de onde montou.

Nunca: empurre para a `develop` ou a `master`, faça merge local nelas (`git merge develop` estando na `master` diverge do
remoto assim que um PR entra), faça force-push, use `--no-verify`, reescreva histórico que já foi empurrado, nem apague
as branches protegidas. Para atualizar uma `master` ou `develop` local, use `git pull --ff-only`; se falhar porque as
branches divergiram, `git reset --hard origin/<branch>` só é correto quando todo commit só-local já existe em outra
branch do remoto (confira com `git log origin/<branch>..<branch>`). Se uma verificação falhar, corrija a causa na
branch; não a contorne.

## 5. Condições de merge

Um PR só pode ser mergeado se as duas condições valem, e o CI as confere:

- **Os testes passam**: `bun run check` (typecheck, lint, formatação, testes com cobertura) está verde, e o site
  builda (`bun run docs:build`, que recusa link quebrado, âncora sem destino e página sem descrição).
- **A cobertura é igual ou maior que a de antes**: o CI compara os limites de cobertura do PR (`coverage-thresholds.json`)
  com os que já estão na branch de destino (que a catraca mantém iguais à última cobertura aprovada). Qualquer métrica
  que caia, ou um limite que seja baixado, reprova o check. Se a cobertura cair, escreva testes; veja a skill
  `coverage-ratchet`. Não baixe um limite nem acrescente uma exclusão para ficar verde.

## Cobrança, num lugar só

| Onde | O que confere |
| --- | --- |
| `.githooks/commit-msg` e `.githooks/pre-commit` (ativados pelo `bun install` por meio do script `prepare`) | o formato e o texto proibido de cada mensagem de commit local; a identidade de autor e committer (`.githooks/commit-identity`) |
| `.github/workflows/ci.yml` | os jobs `pr-text` (título, corpo, mensagens e autoria dos commits do PR), `typecheck`, `lint`, `format`, `test` (testes com cobertura e limites não menores que os da base) e `docs` (`bun run docs:build`); o job `check` junta os seis e é o que os rulesets exigem |
| Rulesets de `develop` e `master` (configurações do repositório → Rules; sem bypass, então valem para quem é dono também) | PR obrigatório, o `check` precisa passar (na `master` também com a branch em dia), sem force-push, sem exclusão; a `develop` só aceita squash, a `master` só merge commit. Para sair deles numa emergência, desligue o ruleset nas configurações e ligue de novo depois. |

Se o hook não está ativo num clone (`git config core.hooksPath` deve imprimir `.githooks`), rode `bun install`.
