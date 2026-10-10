---
name: plans
description: How work is planned in choliba — plan files in `plans/`, the name `[claude|cursor]-<unix-ts>-NN-slug.md`, one plan equals one pull request, every plan estimates its commits, and the minimum sections. Use when creating or naming a plan, deciding how to split work into pull requests, reading `plans/`, or about to implement a plan.
argument-hint: 'The work to plan, or the plan file to execute.'
user-invocable: true
disable-model-invocation: false
---

# Plans

Work that changes this repo starts as a plan in `plans/` at the repo root. That folder is gitignored: a plan is
local working state and is never committed. The filename says which origin wrote it and which origin executes it.
An agent implements only plans whose prefix is its own origin, and keeps at most one pull request open at a time.

## Name

`<origin>-<unix-ts>-<NN>-<slug>.md`

- **origin** is `claude` or `cursor`. Drafts from both origins live in the same `plans/` folder; the prefix keeps
  them apart. Accepted plans join the queue in `NN` order.
- **unix-ts** is the creation time, from `TZ='America/Sao_Paulo' date +%s`.
- **NN** is two digits, the plan's place in the queue (`01`, `02`, …). `00` is an index of the queue, not a pull
  request.
- **slug** is kebab-case.

Example: `cursor-1791597051-01-skill-plans.md`.

Scaffold one with `bash .agents/skills/plans/scripts/new-plan.sh <claude|cursor> <NN> <slug>`.

## One plan, one pull request

- **One plan is one pull request** into `develop`, from a branch `<type>/<description>`. Commits, the review and
  the merge follow the `git-workflow` skill.
- **Every plan estimates its commits** in the header, and lists them. One logical change per commit, in that
  order. Each commit still needs the user's approval before it is created.
- Do not open the pull request until every plan named in `depende de` is merged. `—` means no dependency.
- Do not implement a plan with the other origin's prefix, and do not edit that origin's plan files.

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
