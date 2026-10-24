---
name: plans
description: How work is planned in choliba — every piece of work is a GitHub issue opened with the repo's issue forms, the plan is a comment on the issue, status labels say who executes it, one issue is one pull request that closes it, every plan estimates its commits and maps the project skills to its steps. Use when turning pending work into an issue, writing or reading a plan, picking an issue to execute, splitting work into pull requests, or about to implement an issue.
argument-hint: 'The work to plan, or the issue number to execute.'
user-invocable: true
disable-model-invocation: false
---

# Plans

Work that changes this repo starts as an **issue** in https://github.com/choliba/choliba/issues. The issue says
what is wrong or what is wanted; the **plan** says how it will be done and is a comment on that issue. There is no
other queue: the open issues are the backlog, and an issue closed when its pull request is merged is the history.

The work is an **open pool**: any agent (`claude`, `codex`, `cursor`) may execute any available issue, whoever
opened it. The repository is public: an issue, a plan and a comment never carry secrets, `.env` values, tokens or
personal data, and never paths outside the working folder.

## Opening an issue

Open it in the format of the forms in `.github/ISSUE_TEMPLATE/`, with the form's title prefix and labels:

| Form | Title | Labels |
| ---- | ----- | ------ |
| `1-bug.yml` | `[bug] …` | `bug` |
| `2-feature.yml` | `[feature] …` | `enhancement` |
| `3-execution-error.yml` | `[execution-error] …` | `execution-error`, `bug` |
| `4-architecture-change.yml` | `[architecture] …` | `architecture` |

From the command line, write the body as the form renders it: one `### <field label>` per field, in the form's
order, `_No response_` for an optional field left empty, and `- [X]` / `- [ ]` for checkboxes. Then:

```bash
gh issue create --repo choliba/choliba --title '[bug] …' --label bug --body-file body.md
```

One problem per issue. When an issue needs another one first, comment `Depende de #N` on it.

## Status

The status of an issue is its labels:

| Status | Meaning |
| ------ | ------- |
| no status label | Open and available. A plan comment may exist or not. |
| `em execução` | Someone has a branch or local commits for it; the latest `Pego por <origin>` comment names who. |
| `PR aberto` | The pull request is open, waiting for the merge; the PR is linked to the issue (`Closes #N`). |
| closed | Resolved: its pull request is merged into `develop` (the next release ships it), or closed as not planned. |

Transitions:

1. **Before creating the branch**, assign the issue to yourself, add `em execução` and comment `Pego por <origin>`
   (`claude`, `codex` or `cursor`):
   `gh issue edit N --add-assignee @me --add-label 'em execução'` and `gh issue comment N --body 'Pego por <origin>'`.
2. **On opening the pull request**, swap `em execução` for `PR aberto`. The PR body has `Closes #N`.
3. **After the merge into `develop`**, the `Close issues` workflow (`.github/workflows/close-issues.yml`) closes every
   open issue the PR body names with a closing keyword (`Closes #N`, `Fixes #N`, `Resolves #N`), comments
   `Resolvida em #PR; sai na próxima release.` and removes `PR aberto`. GitHub itself only does this for PRs into the
   default branch (`master`). Check that the issue closed; if the body had no keyword, close it the same way by hand.
4. **Giving up**, remove the assignee and the label (`--remove-assignee @me --remove-label 'em execução'`) and
   comment why, so the next one starts from there.

**Claiming an issue.** There is no atomic lock, so re-reading is the only defence against two agents taking the same
issue:

1. Right before claiming, read the issue again (`gh issue view N --comments`). If it has `em execução` or `PR aberto`,
   pick another one.
2. Assign it to yourself, add the label and the `Pego por` comment.
3. Read it once more. If an earlier `Pego por` from another agent appeared, the other agent won: undo yours and pick
   another one.

Pick an issue only when it has no status label, every `Depende de #N` is merged, and you have no pull request of
your own open.

## The plan

Before implementing, comment the plan on the issue, starting with `## Plano`. Read the project skills that apply
first and name, in each step, the skill that governs it.

```markdown
## Plano

**PR único · commits estimados: N · depende de: —**

### Contexto

### Escopo (1 PR)

### Commits

1. `type(scope): description` — what this commit does (skill: `code-standard`)

### Verificação
```

`### Fora de escopo` is optional. `### Verificação` says how to prove the work and always includes `bun run check`
green by its exit code; a plan that changes docs also includes `bun run docs:build` green. When the plan changes
while executing, edit the comment and say what changed; do not post a second plan.

## One issue, one pull request

- **One issue is one pull request** into `develop`, from a branch `<type>/<description>`, with `Closes #N` in the
  body. Commits, the review and the merge follow the `git-workflow` skill.
- **Every plan estimates its commits** and lists them. One logical change per commit, in that order.
- Work that needs more than one pull request is split into one issue per pull request (each with its own plan),
  linked by `Depende de #N`. The first one keeps the context; the others point to it.
- Do not open the pull request until every `Depende de #N` is merged.
