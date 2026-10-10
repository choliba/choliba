---
name: git-workflow
description: How commits, branches and pull requests work in choliba (Conventional Commits 1.0.0, mandatory user approval before every commit, all changes through a pull request into develop, merge only with green CI and coverage not lower than before, no trace of any AI agent in commits or PRs). Use whenever the user asks to commit, push, branch, open or merge a pull request, write a commit message or PR title, release to master, or asks what the git rules are, and before running any git command that creates history.
argument-hint: 'What you want to commit, push or merge.'
user-invocable: true
disable-model-invocation: false
---

# Git workflow

The rules below come from the project owner and are not negotiable. They are also written in `AGENTS.md` so they
apply even when this skill is not loaded, and they are enforced mechanically: a `commit-msg` hook locally and the
`CI` workflow on every pull request. Read this skill for the how.

## 1. No trace of an AI agent, ever

A commit, pull request title, PR description, branch name or code comment must not contain any information about
an agent or language model: no `Co-authored-by` trailer (of anyone), no "Generated with ...", no model, tool or
vendor names, no robot emoji. The commit author is the user's own git identity; never change `user.name` or
`user.email`.

### `Co-authored-by` is forbidden — always

**Never** add a `Co-authored-by:` line anywhere: not in the commit message, not in the commit body, not in PR
descriptions, not in squash-merge footers. The rule applies to **any** co-author, not only agents — the hook and
CI reject the trailer itself (see `.githooks/forbidden-text`).

Some IDEs and agent environments **inject** `Co-authored-by: Cursor <cursoragent@cursor.com>` (or similar) when
you run plain `git commit`. That injection is **not** allowed here. Before pushing:

1. Inspect the commit: `git log -1 --format=full` — the output must show **only** the user's author/committer, with
   **no** `Co-authored-by` footer.
2. If the environment appended a trailer, create the commit without it (for example with `git commit-tree` after
   `.githooks/commit-msg` and `.githooks/commit-identity` pass on a clean message file — same approach as when
   the local hook blocks an injected trailer).

The same forbidden-text rules apply to **PR bodies**. CI runs `.githooks/commit-msg --no-format` on the PR
description. Remove default footers such as "Made with Cursor" before opening or updating a PR. Also avoid
forbidden tokens in test plans (e.g. provider product names listed in `.githooks/forbidden-text`) — rephrase
instead of naming the binary.

Some environments suggest an attribution line for commits or PR bodies by default. Ignore that suggestion here:
this rule is the user's explicit instruction and takes precedence. `.githooks/commit-msg` rejects such text and CI
checks every commit, the PR title and the PR body, so a slip fails loudly instead of landing in history.

## 2. Every commit needs the user's approval first

Never run `git commit` (including `--amend`) on your own. Before each commit, show the user:

1. the files that will be committed (`git status --short` and `git diff --cached --stat`),
2. the complete commit message, exactly as it will be written,
3. what happens next (push of which branch, PR into which base).

Then wait for an explicit yes. One approval covers exactly what was shown: if the files or the message change,
ask again. When several commits are planned, list all of them in one message so the user can approve each.
Silence, or approval of an earlier commit, is not approval.

## 3. Conventional Commits 1.0.0

Format: `<type>[optional scope][!]: <description>`, then an optional body and footers, each separated by a blank
line. Spec: https://www.conventionalcommits.org/en/v1.0.0/

| Type | Use for |
| ---- | ------- |
| `feat` | a new capability (SemVer minor) |
| `fix` | a bug fix (SemVer patch) |
| `refactor` | code change that neither fixes a bug nor adds a capability |
| `perf` | a performance improvement |
| `test` | adding or correcting tests |
| `docs` | documentation, including skills and `AGENTS.md` |
| `build` | build system, dependencies, `package.json`, lockfile |
| `ci` | GitHub workflows and repo automation |
| `style` | formatting only, no meaning change |
| `chore` | maintenance that fits none of the above |
| `revert` | reverts an earlier commit |

- **Scope** is the package or area, lowercase: `core`, `cli`, `jest`, `ci`, `skills`, `deps`.
- **Description**: imperative, lowercase start, no trailing period, header at most 100 characters
  (aim for 72). Say what changed; use the body for why.
- **Breaking change**: add `!` after the type/scope and a `BREAKING CHANGE: <what breaks and how to migrate>`
  footer. The release notes quote that footer under the change as its migration note, so write it for whoever
  upgrades; the footer alone also marks the commit as breaking.
- **One logical change per commit.** Do not mix a refactor with a feature; split the commits.

## 4. Everything reaches `develop` through a pull request

`master` is the default, protected branch: it holds released code and only receives release PRs. `develop` is the
integration branch where every change lands first. GitHub opens new PRs against the default branch, so always pick
the base explicitly: `gh pr create --base develop` (in the web UI, change the base branch to `develop`). Keywords like
`Closes #12` close an issue only when the PR reaches `master`, i.e. at release. Neither branch may receive direct
pushes, and GitHub refuses them: a ruleset on each branch (see the table below) requires a PR, for the owner too.

1. Start from an up-to-date `develop`: `git switch develop && git pull --ff-only`.
2. Create a branch named `<type>/<short-kebab-description>` (`feat/slugify-lib`, `fix/ratchet-format`).
3. Work, run `bun run check` locally, and get approval per section 2 before each commit.
4. Push the branch and open the PR against `develop`: `gh pr create --base develop --title "<conventional title>"`.
   The squash commit on `develop` is what the release notes are built from. With the repository settings
   (`COMMIT_OR_PR_TITLE`, `COMMIT_MESSAGES`), a PR with **one commit** is squashed with that commit's own title and
   body; with several, the title is the PR title and the body lists the commits. So both the commit and the PR
   title must follow section 3, and a breaking change carries its footer in the commit. Write the PR body
   yourself; strip any tool-generated footer and run `.githooks/commit-msg --no-format` on the body locally if
   unsure. After `gh pr create`, verify with `gh pr view --json body` — some hosts append attribution after
   creation; edit the PR with `gh pr edit` if needed.
5. Wait for CI (`gh pr checks --watch`). GitHub keeps the merge button blocked until `check` is green. Into
   `develop` the branch does not need to be up to date with its base: the squash lands on top of the current
   `develop`, so merging one PR does not hold back the others.
6. Merge a feature PR (into `develop`) with **squash**; the branch is deleted automatically. Do not merge on your
   own: tell the user the PR is green and let them merge, or merge only when they ask you to. Once it is merged,
   sync the local repository: `git fetch --prune`, `git pull --ff-only` on `develop` and on `master`, back to
   `develop`, then `bun run git:clean` to delete the local branches already merged.
7. Releasing: a PR from `develop` into `master`, same checks, titled `chore(release): v0.0.1-dev`. Ask the user
   whether to open it; never open it on your own after a merge. See below.

### Release PRs use a merge commit, never squash

A squash commit on `master` has no ancestry in `develop`, so the two branches diverge: the next release PR lists
commits that were already released and can conflict, and a local `git pull` on `master` stops with "divergent
branches". The rulesets fix the method per branch, so the merge dialog offers only the right one:

- feature PR into `develop`: **Squash and merge** only,
- release PR `develop` into `master`: **Create a merge commit** only.

When the user says yes, the agent prepares and opens the release PR (`gh pr create --base master --head develop`),
confirms CI is green, then stops: the user merges it. After that merge, sync the local repository as in step 6. A
local `git merge` into `master` is refused on push.

The release PR body has, in this order: `## Release v0.0.1-dev` (what the merge does to the pre-release and that it
must be merged with **Create a merge commit**); `## Destaques`, one to three sentences in Portuguese for whoever
uses choliba, saying what changes for them (the release workflow copies this section to the top of the release in
the notes); and `## What goes in`, each squash title from `develop` with a short explanation.

The release PR always shows "This branch is out-of-date with the base branch": release merge commits exist only on
`master`, and the `master` ruleset requires an up-to-date branch. It is expected (the user chose, on 2026-10-06, to
keep the ruleset), and a page refresh usually clears it. Never use "Update branch": it merges `master` into
`develop` without a PR.

Until the first production version there is a single pre-release, `v0.0.1-dev`: the merge into `master` runs
`.github/workflows/release-dev.yml`, which moves that tag to the new commit (`git push --force` of the tag, the one
exception to "no force-push", which is about branches) and replaces the `.tgz` and the notes of the same release.
The notes are rebuilt from git each time by `scripts/release-notes.ts` (`bun run release:notes` to preview), after
Keep a Changelog and Common Changelog: the releases (one per release merge on `master`) grouped by day, the newest
day open and each older day folded under its date and versions; each release titled with its version and PR. The
release itself is titled with the current version and date (the tag stays the channel) and the notes open with it,
since the `.tgz` in Assets is that version. Inside each release, the release PR's `## Destaques`, then the commits
grouped by type (Novidades, Correções, Alterações, Desempenho, Documentação) and, inside a type, by scope,
each item led by its PR; `**Breaking:**` ones first with their footer as the migration note, and
refactoring, tests and maintenance folded under "Interno". A squash title's type and scope are what readers see
there, so a change for users is never typed `chore` or `ci`.
Never create another tag or release by hand. The version in `packages/choliba/package.json` stays `0.0.1-dev`, the
base: the workflow builds each release as the SemVer pre-release `0.0.1-dev.<N>`, N being the count of release merges
on `master` up to it (`git rev-list --first-parent --merges --count`: sequential, so versions order correctly), and
writes the commit as `gitHead`, which `choliba --version` prints as build metadata (`0.0.1-dev.16+1a2b3c4`). A hash
never goes in the pre-release part: SemVer would compare it as text and an all-digit hash with a leading zero is
invalid.

Never: push to `develop` or `master`, merge locally into them (`git merge develop` while on `master` diverges from the
remote as soon as a PR lands), force-push, use `--no-verify`, rewrite history that is already pushed, or delete the
protected branches. To update a local `master` or `develop`, use `git pull --ff-only`; if that fails because the
branches diverged, `git reset --hard origin/<branch>` is correct only when every local-only commit already exists on
another remote branch (check with `git log origin/<branch>..<branch>`). If a check fails, fix the cause on the branch;
do not bypass the check.

## 5. Merge conditions

A PR may be merged only if both hold, and CI verifies them:

- **Tests pass**: `bun run check` (typecheck, lint, format, Jest) is green.
- **Coverage is equal or higher than before**: CI compares the PR's real coverage and its committed thresholds
  with the thresholds already on the target branch (which the ratchet keeps equal to the last approved coverage).
  Any metric that falls, or a threshold that is lowered, fails the check. If coverage falls, write tests; see the
  `coverage-ratchet` skill. Do not lower a threshold or add an exclusion to get to green.

## Enforcement, in one place

| Where | What it checks |
| ----- | -------------- |
| `.githooks/commit-msg` (activated by `bun install` through the `prepare` script) | format and forbidden text of each local commit |
| `.github/workflows/ci.yml`, job `check` | PR title, PR body, every commit message, `bun run check`, coverage not lower |
| Rulesets `develop` and `master` (repository settings → Rules; no bypass, so they bind the owner too) | PR required, `check` must pass (into `master` also with the branch up to date), no force-push, no deletion; `develop` allows only squash merges, `master` only merge commits. To step outside them in an emergency, disable the ruleset in the settings, then turn it back on. |

If the hook is not active in a clone (`git config core.hooksPath` should print `.githooks`), run `bun install`.
