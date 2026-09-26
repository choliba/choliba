---
name: add-workspace-package
description: Add a new package (library or app) to the choliba Bun monorepo the way the project expects it, wired into TypeScript, ESLint, Prettier, Jest and the coverage ratchet from the first commit. Use whenever the user wants a new package, lib, app, module, service or workspace in choliba, or asks where new code should live, or wants one package to depend on another, even if they never say "workspace".
argument-hint: 'Package name (kebab-case), lib or app, and which existing packages it depends on.'
user-invocable: true
disable-model-invocation: false
---

# Add a workspace package

choliba is a Bun workspace: libraries live in `packages/*`, deployable apps in `apps/*`. Every package
shares the root `tsconfig.base.json`, ESLint, Prettier, Jest and coverage config, so a new package is mostly
directory structure plus two small manifests. The script does that part exactly, which matters because a
missing `typecheck` script or a wrong `extends` path silently drops the package out of a quality gate.

## Steps

1. **Pick the kind.** `lib` for reusable code other packages import; `app` for something with an entrypoint
   (a CLI, a server). If unsure, start with `lib`: an app is a lib plus a thin `main.ts`.
2. **Create it.** Names are kebab-case, without the scope (the script adds `@choliba/`):
   `bash .agents/skills/add-workspace-package/scripts/add-package.sh <name> lib|app`
   It writes `package.json`, `tsconfig.json`, and a starter source and spec, runs `bun install` so the
   workspace symlink exists, then `format:fix`. It refuses to overwrite an existing package.
3. **Write the real behavior test first.** Replace the starter spec with a failing spec for what the package
   should do, make it pass, then delete the starter code. The starter exists only so the gates have something
   to check the moment the package appears.
4. **Wire dependencies.** To use a sibling, add `"@choliba/<name>": "workspace:*"` to the dependent's
   `package.json` `dependencies`, run `bun install`, and import from `@choliba/<name>`. Libraries expose
   `./src/index.ts` through `exports`, so no build is needed. For an external package, run `bun add <pkg>`
   from inside that package's directory so it lands in the right `package.json` (Bun guide:
   https://bun.com/guides/install/workspaces). Shared tooling goes in the root `devDependencies` instead.
   Always finish with `bun install`: a stale `bun.lock` fails `--frozen-lockfile` in CI.
5. **Run the gates.** `bun run check` must pass (typecheck, lint, format, Jest with coverage), and
   `bash .agents/skills/quality-gates/scripts/verify.sh` confirms the new package is inside every gate and the
   lockfile is current. See the `quality-gates` skill if something fails, and the `coverage-ratchet` skill
   before touching thresholds.

## Conventions that keep the package inside the gates

- **Logic in testable modules, thin entrypoints.** Apps keep `src/main.ts` to wiring only; behavior goes in
  `run.ts` or similar. `main.ts` is excluded from coverage, so any logic left in it is invisible to the ratchet.
- **Specs live in `src/__tests__/`**, named `*.spec.ts` and importing the code one level up
  (`import { run } from '../run'`). Jest only discovers `{packages,apps}/*/src/__tests__/**/*.spec.ts`, so a spec
  anywhere else silently never runs; `verify.sh` fails if it finds one. Group with subfolders when it helps
  (`src/__tests__/parsing/tokens.spec.ts`).
- **Helpers and fixtures go in `src/__tests__/` too** (for example `__tests__/helpers/builders.ts`). The whole
  folder is excluded from coverage, so support code there never counts as untested production code. Do not put
  real logic in it.
- **Test libraries through the public entrypoint** (`../index`), so re-export files are exercised too.
- **Extra `@types`.** TypeScript 6 loads no `@types/*` implicitly. If the package needs one (for example
  `bun` for `Bun.*` APIs), list it in that package's `tsconfig.json` under `compilerOptions.types` in addition
  to the inherited `node` and `jest`. Note Jest runs on Node, so code calling `Bun.*` cannot be executed by
  specs directly: put the call behind a small interface and test the logic.
- **Publishing to npm is out of scope.** Packages are internal and unbuilt. If the user wants to publish one,
  that needs a build step and a decision from them.

## Adding a package by hand

If the script cannot be used, mirror an existing package exactly: `package.json` with `"type": "module"`, a
`typecheck` script (`tsc --noEmit -p tsconfig.json`), and a `tsconfig.json` that `extends` the root
`../../tsconfig.base.json` and includes `src`. The root `typecheck` script runs each package's own, so a package
without that script is skipped without any error.
