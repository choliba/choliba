# Nest CLI monorepo mode → choliba workspaces

The Nest docs ([monorepo](https://docs.nestjs.com/cli/monorepo), [libraries](https://docs.nestjs.com/cli/libraries))
describe a workspace managed by the Nest CLI. choliba already has a workspace managed by Bun, so every Nest concept
has a counterpart here:

| Nest CLI monorepo mode                                 | choliba                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `nest generate app <name>` → `apps/<name>`             | `add-package.sh <name> app` → `apps/<name>`                          |
| `nest generate library <name>` → `libs/<name>`         | `add-package.sh <name> lib` → `packages/<name>`                      |
| `nest-cli.json` `projects` entries                     | `workspaces` in the root `package.json` (`packages/*`, `apps/*`)     |
| one root `package.json` and `node_modules`             | one `package.json` per package; Bun hoists and links them            |
| `@app/<lib>` via `paths` in the root `tsconfig.json`   | `@choliba/<lib>` via the package's `exports` (`./src/index.ts`)      |
| `tsconfig.app.json` / `tsconfig.lib.json`              | the package's `tsconfig.json`, extending `../../tsconfig.base.json`  |
| `entryFile: "index"` of a library                      | `exports["."]` of the package                                        |
| `nest build` (Rspack/webpack/tsc into `dist/`)         | no build: Bun runs TypeScript, `tsc --noEmit` typechecks             |
| `nest start --watch`                                   | `bun --watch apps/<name>/src/main.ts`                                |
| `test/` folder with `jest-e2e.json`                    | `src/__tests__/` under the one root Jest config                      |
| `*.spec.ts` next to the source                         | `src/__tests__/**/*.spec.ts`                                         |

## Why not the Nest CLI monorepo

- **One `package.json` for everything** would undo the per-package dependencies the Bun workspace relies on (and
  that `add-workspace-package` and `verify.sh` check).
- **`paths` aliases plus a bundler** duplicate what `exports` and Bun already do, and add a build the rest of the
  repo does not have.
- **Per-project `tsconfig.app.json` and a separate e2e Jest config** fall outside `bun run typecheck` (which runs
  each package's own `typecheck` script) and outside the single coverage ratchet.

The only effect of Nest's mode choice is how projects are composed and built (the docs say so); modules, providers
and DI work the same either way, so nothing in Nest itself is lost.
