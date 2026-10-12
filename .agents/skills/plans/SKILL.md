---
name: plans
description: How work is planned in choliba — plan files in `plans/`, the name `<author>-<unix-ts>-NN-slug.md`, the shared queue index `plans/00-indice.md` with its statuses, an open pool where any agent executes any available plan, one plan equals one pull request, every plan estimates its commits, and the minimum sections. Use when creating or naming a plan, picking a plan to execute, updating the queue index, deciding how to split work into pull requests, reading `plans/`, or about to implement a plan.
argument-hint: 'The work to plan, or the plan file to execute.'
user-invocable: true
disable-model-invocation: false
---

# Plans

Work that changes this repo starts as a plan in `plans/` at the repo root. That folder is gitignored: a plan is
local working state and is never committed. `plans/` may be a symlink to one folder shared by several clones, so
every agent sees the same plans and the same index at once.

The plans form an **open pool**: any agent (`claude`, `cursor`, `codex`) may execute any available plan, whoever
wrote it. The filename says who wrote the draft; the current executor is the one in the status
`em execução por <origin>` in [`plans/00-indice.md`](#queue-index). Each agent keeps at most one pull request open
at a time.

## Name

`<author>-<unix-ts>-<NN>-<slug>.md`

- **author** is `claude`, `cursor` or `codex`: who wrote the draft, **not** who executes it. Drafts from every
  author live in the same `plans/` folder. Executing a plan with another author's prefix needs no rename.
- **unix-ts** is the creation time, from `TZ='America/Sao_Paulo' date +%s`.
- **NN** is two digits, the plan's place in the active queue (`01`, `02`, …). `00` is the queue index, not a pull
  request. Numbering restarts at `01` when the active queue is empty (every plan merged or abandoned); plans in the
  history do not hold their numbers.
- **slug** is kebab-case.

Example: `cursor-1791597051-01-skill-plans.md`.

Scaffold one with `bash .agents/skills/plans/scripts/new-plan.sh <claude|cursor|codex> <NN> <slug>`. When
`plans/00-indice.md` exists, the script also appends the plan to the active queue as `rascunho`, with the slug as
its title; fix the title and `Depende de` by hand.

## Queue index

`plans/00-indice.md` (no author, no timestamp: `00` already says it is the index) is the shared panel of the queue.
It is an aid: git and GitHub stay the source of truth for branches, pull requests and merges.

The active queue is a table:

```markdown
| NN | Autor | Título | Status | PR | Depende de |
|---|---|---|---|---|---|
| 01 | claude | Sandbox: isolated network | em execução por codex | — | — |
```

Statuses, where `<origin>` is `claude`, `cursor` or `codex` and may differ from the author:

| Status | Meaning |
| ------ | ------- |
| `rascunho` | Written; nobody is implementing it. |
| `próximo` | Will be taken as soon as the executor's current plan or a dependency is merged. |
| `em execução por <origin>` | `<origin>` has a branch or local commits for it. |
| `PR aberto por <origin>` | Pull request open, waiting for the merge; the `PR` column holds `#<number>`. |
| `mergeado` | Merged into `develop`; the row moves to the history. |
| `abandonado` | Dropped before a pull request; the row moves to the history and keeps the NN traceable. |

Transitions:

1. **Before creating the branch**, mark the plan `em execução por <you>`.
2. **On opening the pull request**, mark it `PR aberto por <you>` and fill the `PR` column.
3. **After the merge**, move the row to the "Histórico" table (`NN | Autor | Executor | Título | Resultado | PR`)
   and delete the plan's `.md` from `plans/`.

**Claiming a plan.** There is no atomic lock, so re-reading the index is the only defence against two agents
taking the same plan:

1. Re-read the index right before marking; do not trust an earlier read. If the plan is already
   `em execução por` someone else, leave it and pick another.
2. Mark it `em execução por <you>` (wrap the edit in `flock plans/00-indice.md -c '…'` when available).
3. Re-read once more. If the row now names another agent, the other agent won: pick another plan.

**Who edits a row.** An agent edits only rows whose current or about-to-be executor is itself; any agent may write
a row that is `rascunho` or `próximo`. The author has no editing precedence. A plan file is edited by its executor,
or by its author while it is still `rascunho`.

## One plan, one pull request

- **One plan is one pull request** into `develop`, from a branch `<type>/<description>`. Commits, the review and
  the merge follow the `git-workflow` skill.
- **Every plan estimates its commits** in the header, and lists them. One logical change per commit, in that
  order. Each commit still needs the user's approval before it is created.
- Do not open the pull request until every plan named in `depende de` (the index's `Depende de`) is merged. `—`
  means no dependency.
- Pick a plan only when it is `rascunho` or `próximo` and you have no pull request of your own open.

## Minimum sections

```markdown
# NN — Title

**PR único · commits estimados: N · depende de: —**

## Contexto

## Escopo (1 PR)

## Commits

1. `type(scope): description` — what this commit does

## Verificação
```

`## Fora de escopo` is optional. `## Verificação` says how to prove the plan, and always includes `bun run check`
green. A plan that changes docs also includes `bun run docs:build` green.
