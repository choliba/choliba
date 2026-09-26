# Coverage ratchet

The ratchet does not just set coverage numbers, it makes coverage unable to regress silently. Its thresholds
started at 0 and rose to whatever the code reached; no number was carried over from another project.

## How it works

1. `jest/jest.coverage.config.json` (tracked in git) holds the whole coverage setup under `coverageConfig`:
   `collectCoverageFrom` (exclusions), reporters, the teardown path and `coverageThreshold.global` for lines, statements, functions and
   branches. It started at 0 and has been raised by the ratchet since.
2. `jest/jest.config.ts` turns coverage on only when `--coverage` is on the command line (`bun run test:cov`)
   and merges that JSON's `coverageConfig` into the Jest config, which also registers
   `jest/jest.teardown.config.ts` as `globalTeardown`. The package.json scripts pass `--config jest/jest.config.ts`. Plain
   `bun run test` skips all of it, so the inner TDD loop stays fast.
3. Jest itself fails the run if any metric is below its threshold. That is the regression guard.
4. After a run that met every threshold, the teardown raises each threshold to `max(current, actual)`,
   metric by metric, and regenerates `COVERAGE.md` (per-file table with 🔴/🟡/🟢) and
   `.github/badges/coverage.json` (shields.io endpoint badge, average of the four metrics).
   Thresholds never go down on their own.

Consequence to tell the user: the first `bun run check` lifts the thresholds to whatever the starter code
reaches (100 %). From then on, new code has to arrive tested. That is the TDD-friendly default. If they want a
lower floor, they edit `jest/jest.coverage.config.json` by hand; ask before doing that for them.

## Where things live

| File | Role |
| ---- | ---- |
| `jest/jest.config.ts` | Jest config; `rootDir` is the repo root, coverage merged in only with `--coverage` |
| `jest/jest.coverage.config.json` | Exclusions, reporters, teardown path and the ratcheted thresholds |
| `jest/jest.teardown.config.ts` | The ratchet: raises thresholds, rewrites `COVERAGE.md` and the badge |
| `jest/jest.coverage.report.ts` | Builds the `COVERAGE.md` table and the shields badge JSON |

There is deliberately no `scripts/` folder: everything the repo runs is Jest-related and lives in `jest/`.
JSON cannot hold comments, so the reasons behind the exclusions are in the next section, not in the file.
The teardown rewrites `jest/jest.coverage.config.json` through Prettier (with the `.editorconfig` rules), so the
file it writes is byte-identical to what `bun run format` accepts; without that the ratchet would break the next
`check`. Add `jest/jest.setup.ts` when tests first need global setup (for example a `fetch` mock) and list it in
`setupFiles` in `jest/jest.config.ts`.

## Design decisions

| Choice | Alternative not taken | Reason |
| ------ | --------------------- | ------ |
| Skip writing the reports when any metric is below its threshold | Rewrite on every run | A failing run was overwriting the report with the worse numbers. Reproduced and fixed. |
| Rewrite `COVERAGE.md`, the badge and the thresholds only when their content changes (the time line is ignored) | Rewrite on every run | Every test run dirtied the working tree with a new timestamp, inviting noise commits. |
| Parse JSON as `unknown` and narrow with `isRecord` | `JSON.parse(...)` assigned untyped (`any`) | `no-unsafe-*` rules reject `any`; this project forbids it. |
| `esbuild-register` loads `jest.config.ts` | ts-node | ts-node fails under TypeScript 6 with `verbatimModuleSyntax`. |
| `globalConfig.rootDir` from Jest | `__dirname` in the teardown | Uses the root Jest was started with instead of a file-relative guess. |
| `bun run test:cov` in the generated text | `yarn` / `npm` commands | Bun is the package manager. |
| `packages/*/src/**` and `apps/*/src/**` | A single-package `src/**` | Monorepo layout. |

## What is excluded from coverage, and why

`collectCoverageFrom` keeps production source only. It excludes `*.spec.ts` and everything under `__tests__/` (test code and its helpers), `*.d.ts`, `main.ts` (entrypoints:
wiring only, logic goes in a tested `run.ts`), `*.interface.ts` and `*.types.ts` (no executable code).

Do not add an exclusion to make a number go up. Excluding a file that holds business logic hides exactly what the
ratchet exists to protect; if a user asks for that, stop and confirm. Do not write tests that only execute
declarations to inflate coverage either: test behavior, including failure paths and branches.

## Optional CI extension: commit the ratchet back to the PR branch

There is no CI workflow in the repo yet. If the user hosts on GitHub, this minimal one runs the same gates and
enforces the thresholds (`.github/workflows/tests.yml`), but does not persist a raised threshold:

```yaml
name: Tests

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bun run typecheck

      - name: Lint
        run: bun run lint

      - name: Format (Prettier)
        run: bun run format

      - name: Tests with coverage (enforces the ratchet in jest/jest.coverage.config.json)
        run: bun run test:cov

      - name: Upload coverage report (diagnostics on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 5
```

A workflow can also persist it, and that is worth offering:

- After `bun run test:cov` succeeds, `git add jest/jest.coverage.config.json COVERAGE.md .github/badges` and, only if
  `jest/jest.coverage.config.json` changed, commit and push to the PR branch.
- Push with a personal access token stored as a secret (for example `COVERAGE_RATCHET_PAT`). A push
  made with the default `GITHUB_TOKEN` does not trigger a new workflow run, so the new commit would never be
  checked.
- Guard the step with `if: success()`: a custom `if` replaces the default success condition instead of adding
  to it.
- The reference also auto-closes PRs when CI fails. That is a team policy, not a tooling requirement; leave it
  out unless the user asks for it.

The workflow above has not been executed on GitHub Actions in this environment: say so when adding it.
