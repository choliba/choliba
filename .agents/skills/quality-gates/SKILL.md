---
name: quality-gates
description: Run, debug or change choliba's quality pipeline: TypeScript 6.0 hard typing (no any), ESLint type-checked rules, Prettier and .editorconfig, Jest, and the single `bun run check` command. Use before declaring any code change done, when typecheck, lint, format or tests fail, when editing tsconfig, eslint, jest, prettier or editorconfig files, when upgrading dependencies (especially typescript, whose npm latest is 7.x), or when someone reaches for `any`, `@ts-ignore`, `!` or `bun test`.
argument-hint: 'What failed, or which tool/config you want to change.'
user-invocable: true
disable-model-invocation: false
---

# Quality gates

One command runs everything, in this order: `bun run check` = typecheck, lint, format check, Jest with
coverage. CI and local runs use the same command, so "it passes here" means the same thing everywhere.

| Command                | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `bun run typecheck`    | `tsc --noEmit` in every package, then the root config files   |
| `bun run lint`         | ESLint, type-checked strict rules                             |
| `bun run format`       | Prettier in check mode (never rewrites)                       |
| `bun run format:fix`   | Prettier write; run it after hand edits, before `check`       |
| `bun run test`         | Jest, no coverage (fast inner loop)                           |
| `bun run test:cov`     | Jest with coverage thresholds and the ratchet                 |
| `bun run check`        | All of the above in a deterministic order                     |
| `bun run docs:build`   | The documentation site (VitePress); CI runs it after `check`  |

## When a gate fails

Fix the code or the config that owns the failure. Do not loosen strictness, add an `eslint-disable`, exclude a
package from a gate, or swap the runner to make it green: each of those removes the protection the gate exists
for. If the failure looks like a tooling problem rather than a code problem, read
`references/tooling-notes.md`; it lists the TypeScript 6 and Jest-under-Bun traps that were hit while building
this setup, with the fix for each.

## Invariants, and why

- **TypeScript stays on 6.0.x.** npm's `latest` for `typescript` is 7.x, so a bare `bun add typescript` upgrades
  past the required version. Always pin the range (`typescript@~6.0.3`) and confirm with `bunx tsc --version`.
  If 6.0.x cannot be resolved, stop and report; never fall back to 5.x or 7.x.
- **No `any`, and that means type-checked lint, not just a rule.** `no-explicit-any` catches only a written
  `any`. Untyped `JSON.parse` output, a library returning `any`, `@ts-ignore` and `!` slip past it; the
  `strictTypeChecked` rules (`no-unsafe-*`, `ban-ts-comment`, `no-non-null-assertion`) catch them. Parse
  untrusted data as `unknown` and narrow. A `@ts-expect-error` needs a written reason and a test.
- **Repository scripts are tested too.** `scripts/*.ts` is typechecked and linted; logic worth testing goes in
  `scripts/libs/` with specs in `scripts/__tests__/`, which Jest also runs. Coverage is measured only in the
  packages, so a script without specs does not break the ratchet.
- **Jest runs the tests; `bun test` does not count.** `bun test` is Bun's own runner. It executes the same
  spec files, so it looks fine, but it skips ts-jest, coverage thresholds and the ratchet. Use `bun run test`.
- **Bun is the only package manager.** One `bun.lock`; no npm, Yarn or pnpm lockfiles or scripts.
- **ESLint and Prettier do different jobs.** `eslint-config-prettier` stays last in `eslint.config.ts` so they
  never fight. `.editorconfig` is the one source for indent, line endings and line width, and Prettier reads
  it; do not duplicate `printWidth` in `.prettierrc.json`, because two sources drift.

## Prove the guards are armed

A green `check` says the code is clean, not that the checks still bite. After changing any tool config, run:

`bash .agents/skills/quality-gates/scripts/verify.sh`

It first checks that every workspace package is actually inside the gates (a `typecheck` script, a tsconfig
extending `tsconfig.base.json`, at least one spec in `src/__tests__/` and none outside it), that `bun.lock` is current, and that `.editorconfig` exists.
This matters because `bun run typecheck` silently skips a package without its own `typecheck` script. Then it
runs `check`, feeds the tools deliberately bad code (explicit and implicit `any`, `@ts-ignore`, a non-null
assertion, a coverage regression) and confirms each one is rejected, and confirms a failed run did not
overwrite `COVERAGE.md`. It cleans up after itself. Expect `ALL GATES VERIFIED`.

## `.editorconfig`

`.editorconfig` at the root is the single source for indentation (2 spaces), line endings (LF), final newline,
trailing whitespace and `max_line_length` (120). Editors apply it as you type and Prettier reads it, so the two
cannot disagree. It relaxes trailing-whitespace and line length for Markdown, line length for JSON and lockfiles,
uses tabs for Makefiles and CRLF for Windows scripts. `.gitattributes` (`* text=auto eol=lf`) enforces the LF
promise at checkout. To change width or indentation, edit `.editorconfig` only, not `.prettierrc.json`.

## Official docs

TypeScript 6.0 release notes: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html ·
Bun: https://bun.com/docs · Bun workspaces: https://bun.com/guides/install/workspaces ·
ESLint: https://eslint.org/docs/latest/ · Prettier: https://prettier.io/docs/ ·
Jest: https://jestjs.io/pt-BR/docs/getting-started

## Changing tool configuration

Ask before changing: the TypeScript range, the strictness flags in `tsconfig.base.json`, the ESLint rule set,
or anything in `jest/jest.coverage.config.json` (see the `coverage-ratchet` skill). Changing style preferences
(quotes, line width in `.editorconfig`) is fine, then run `bun run format:fix` and `bun run check`.
Upgrading a dependency: check the peer ranges first (typescript-eslint supports TypeScript below 6.1, ts-jest
below 7), then run `verify.sh`.
