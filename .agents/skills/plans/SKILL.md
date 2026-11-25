---
name: plans
description: Como o trabalho é planejado no Choliba — todo trabalho é uma issue do GitHub aberta com os formulários do repositório, o plano é um comentário na issue, rótulos de status dizem quem executa, uma issue é um pull request que a fecha, todo plano estima seus commits e liga as skills do projeto aos seus passos. Use ao transformar uma pendência em issue, escrever ou ler um plano, escolher uma issue para executar, dividir um trabalho em pull requests, ou antes de implementar uma issue.
argument-hint: 'O trabalho a planejar, ou o número da issue a executar.'
user-invocable: true
disable-model-invocation: false
---

# Planos

O trabalho que muda este repositório começa como uma **issue** em https://github.com/choliba/choliba/issues. A issue diz
o que está errado ou o que se quer; o **plano** diz como será feito e é um comentário nessa issue. Não há outra fila: as
issues abertas são o backlog, e uma issue fechada quando o pull request é mergeado é o histórico.

O trabalho é um **pool aberto**: qualquer agente (`claude`, `codex`) pode executar qualquer issue disponível, seja quem
for que a abriu. O repositório é público: uma issue, um plano e um comentário nunca levam segredos, valores do `.env`,
tokens nem dados pessoais, e nunca caminhos fora da pasta de trabalho.

## Abrindo uma issue

Abra no formato dos formulários de `.github/ISSUE_TEMPLATE/`, com o prefixo de título e os rótulos do formulário:

| Formulário | Título | Rótulos |
| --- | --- | --- |
| `1-bug.yml` | `[bug] …` | `bug` |
| `2-feature.yml` | `[feature] …` | `enhancement` |
| `3-execution-error.yml` | `[execution-error] …` | `execution-error`, `bug` |
| `4-architecture-change.yml` | `[architecture] …` | `architecture` |

Pela linha de comando, escreva o corpo como o formulário o renderiza: um `### <rótulo do campo>` por campo, na ordem do
formulário, `_No response_` para um campo opcional deixado vazio e `- [X]` / `- [ ]` para as caixas de seleção. Depois:

```bash
gh issue create --repo choliba/choliba --title '[bug] …' --label bug --body-file body.md
```

Ou ponha o título e os rótulos num frontmatter no topo do arquivo (`title`, `labels` e, se quiser, `repo`) e rode
`bun run issue <arquivo>`: o script cria os rótulos que faltam e abre a issue; com `--dry`, só mostra o que criaria.

Um problema por issue. Quando uma issue precisa de outra antes, comente `Depende de #N` nela.

## Estado

O estado de uma issue são os rótulos dela:

| Estado | Significado |
| --- | --- |
| sem rótulo de estado | Aberta e disponível. Pode haver ou não um comentário de plano. |
| `em execução` | Alguém tem uma branch ou commits locais para ela; o último comentário `Pego por <origem>` diz quem. |
| `PR aberto` | O pull request está aberto, esperando o merge; o PR está ligado à issue (`Closes #N`). |
| fechada | Resolvida: o pull request foi mergeado na `develop` (a próxima release a entrega), ou fechada como não planejada. |

Transições:

1. **Antes de criar a branch**, atribua a issue a você, ponha `em execução` e comente `Pego por <origem>` (`claude` ou
   `codex`): `gh issue edit N --add-assignee @me --add-label 'em execução'` e
   `gh issue comment N --body 'Pego por <origem>'`.
2. **Ao abrir o pull request**, troque `em execução` por `PR aberto`. O corpo do PR tem `Closes #N`.
3. **Depois do merge na `develop`**, o workflow `Close issues` (`.github/workflows/close-issues.yml`) fecha toda issue
   aberta que o corpo do PR cita com uma palavra-chave de fechamento (`Closes #N`, `Fixes #N`, `Resolves #N`), comenta
   `Resolvida em #PR; sai na próxima release.` e tira o `PR aberto`. O próprio GitHub só faz isso para PRs na branch
   padrão (`master`). Confira se a issue fechou; se o corpo não tinha a palavra-chave, feche do mesmo jeito à mão.
4. **Ao desistir**, tire o responsável e o rótulo (`--remove-assignee @me --remove-label 'em execução'`) e comente por
   quê, para o próximo começar dali.

**Pegando uma issue.** Não há trava atômica, então reler é a única defesa contra dois agentes pegarem a mesma issue:

1. Logo antes de pegar, leia a issue de novo (`gh issue view N --comments`). Se ela tem `em execução` ou `PR aberto`,
   escolha outra.
2. Atribua a você, ponha o rótulo e o comentário `Pego por`.
3. Leia mais uma vez. Se apareceu um `Pego por` anterior de outro agente, o outro ganhou: desfaça o seu e escolha outra.

Só pegue uma issue quando ela não tem rótulo de estado, todo `Depende de #N` já foi mergeado e você não tem um pull
request seu aberto.

## O plano

Antes de implementar, comente o plano na issue, começando por `## Plano`. Leia primeiro as skills do projeto que se
aplicam e nomeie, em cada passo, a skill que o governa.

```markdown
## Plano

**PR único · commits estimados: N · depende de: —**

### Contexto

### Escopo (1 PR)

### Commits

1. `tipo(escopo): descrição` — o que este commit faz (skill: `object-calisthenics`)

### Verificação
```

`### Fora de escopo` é opcional. `### Verificação` diz como provar o trabalho e sempre inclui o `bun run check` verde
pelo código de saída; um plano que muda a documentação (`guides/`, `docs/`, o README) inclui também o
`bun run docs:build` verde. Quando o plano muda durante a execução, edite o comentário e diga o que mudou; não poste um
segundo plano.

## Uma issue, um pull request

- **Uma issue é um pull request** na `develop`, de uma branch `<tipo>/<descrição>`, com `Closes #N` no corpo. Os
  commits, a revisão e o merge seguem a skill `git-workflow`.
- **Todo plano estima os commits** e os lista. Uma mudança lógica por commit, nessa ordem.
- Um trabalho que precisa de mais de um pull request se divide em uma issue por pull request (cada uma com o próprio
  plano), ligadas por `Depende de #N`. A primeira guarda o contexto; as outras apontam para ela.
- Não abra o pull request até todo `Depende de #N` estar mergeado.
