---
name: coverage-ratchet
description: Explains and safely operates choliba's coverage ratchet (thresholds that only go up): jest/jest.coverage.config.json, COVERAGE.md, the shields badge, coverage exclusions and the Jest globalTeardown. Use when coverage fails or drops, when asked to change a threshold or exclude a file from coverage, when COVERAGE.md or the badge looks wrong, when setting up coverage in CI, or when someone asks why the numbers can't go down.
argument-hint: 'The coverage failure, or the threshold/exclusion change being considered.'
user-invocable: true
disable-model-invocation: false
---

# Coverage ratchet

Coverage in choliba cannot regress silently. Thresholds live in `jest/jest.coverage.config.json` (tracked in git) and
rise automatically to whatever a passing run reaches; Jest fails any run that falls below them.

## The loop, in five lines

1. `bun run test:cov` runs Jest with `--coverage`; plain `bun run test` skips all of this.
2. Jest compares the run with `coverageThreshold.global` and fails on any metric below it.
3. On a run that met every threshold, `jest/jest.teardown.config.ts` raises each threshold to
   `max(current, actual)`, metric by metric. It never lowers one.
4. The same teardown updates `COVERAGE.md` (per-file table) and `.github/badges/coverage.json` (badge), but only when
   coverage actually changed (the generation time does not count), so running the tests leaves the tree clean.
5. A run that failed a threshold leaves those files alone, so they always show the last good state.

Commit `jest/jest.coverage.config.json`, `COVERAGE.md` and `.github/badges/`. Do not edit `COVERAGE.md` by hand.

## When coverage fails

The fix is a test, not a number. Read the failing file in `coverage/coverage.txt` or `COVERAGE.md`, find the
uncovered branch or failure path, and write a spec that exercises it through real behavior. Do not write tests
that only execute declarations to inflate a percentage; they raise the threshold without protecting anything, and
the ratchet then locks that hollow number in.

## Things that need the user's explicit say-so

- **Lowering a threshold** in `jest/jest.coverage.config.json`. The whole point is that this is deliberate and visible.
  Suggest it only when a real, understood reason exists, and edit only the metric they name.
- **Adding to `collectCoverageFrom` exclusions** in `jest/jest.coverage.config.json`. Today it excludes specs and the
  whole `__tests__/` folder (test code and helpers), `.d.ts`, `main.ts` (wiring-only entrypoints),
  `*.interface.ts` and `*.types.ts` (no executable code). Excluding a file
  that holds logic hides exactly what the ratchet protects. If a file is hard to cover, that is usually a
  design signal: move the logic into a testable module and keep the excluded file thin.

## Design decisions

The thresholds started at 0 and the ratchet raised them to whatever the code reached; no number was carried over
from anywhere else. A few deliberate choices (failed runs do not overwrite the report, the report is rewritten only
when coverage really changed, typed parsing instead of `any`, the `esbuild-register` config loader instead of
ts-node) are explained in `references/details.md`, along with the optional CI step that commits a raised threshold
back to a PR branch. Read it before editing the teardown script or setting up CI.

## Related

`quality-gates` for the full `check` pipeline, `add-workspace-package` when a new package needs coverage from
its first commit (it does automatically: `packages/*/src` and `apps/*/src` are collected).
