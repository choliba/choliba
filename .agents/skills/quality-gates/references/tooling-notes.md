# Tooling notes: why the configuration looks the way it does

Every non-obvious choice in the root config files was found by running the toolchain, not by reading docs.
Versions below were verified on 2026-09-21 (Bun 1.4.2, TypeScript 6.0.3, Jest 30.5.2, ts-jest 29.4.12,
ESLint 10.11, typescript-eslint 8.70.1, Prettier 3.9.8). Re-check peer ranges before bumping anything.

## Contents

- TypeScript 6.0 traps
- Jest under Bun
- Strict typing: what `no-explicit-any` alone misses
- Prettier and `.editorconfig`
- Bun workspace details
- Decorators and the Playwright loader

## TypeScript 6.0 traps

**`latest` on npm is TypeScript 7.x.** `bun add -d typescript` silently installs 7.0.2. The repo pins
`"typescript": "~6.0.3"`; when adding or upgrading, always name the range (`bun add -d typescript@~6.0.3`) and
confirm with `bunx tsc --version`. TypeScript 6.0 is the last JS-based release and deprecates several options
(`moduleResolution: node`, `baseUrl`, `target: es5`) that TypeScript 7 removes, so avoid them.

**`types` now defaults to `[]`.** Nothing from `@types/*` is loaded implicitly. Without
`"types": ["node", "jest"]` you get "Cannot find name 'describe'" and "Cannot find name 'process'". Add other
`@types/*` packages to that list when a package needs them (for example `"bun"` for a package that uses `Bun.*`).

**`rootDir` now defaults to the tsconfig directory, `strict` defaults to `true`, `module` to `esnext`,
`target` to `es2025`.** `tsconfig.base.json` sets `noEmit: true`, so the `rootDir` change does not bite, and cross-package
imports (`@scope/core` resolving to `packages/core/src/index.ts`) typecheck fine. If a package ever needs to emit
declarations or JS, that is a separate decision: ask before introducing a build step.

**`esModuleInterop` cannot be `false` anymore**, but ts-jest still prints warning TS151001 unless the tsconfig
sets it to `true` explicitly. `tsconfig.base.json` does.

**`ts-node` breaks.** With `"type": "module"` and `verbatimModuleSyntax`, ts-node fails with TS1295 when Jest
loads `jest.config.ts`. Do not add ts-node.

## Jest under Bun

- Jest 30 loads `jest.config.ts` through either `ts-node` or `esbuild-register`, selected by the docblock
  `/** @jest-config-loader esbuild-register */` on the first line. `jiti` is rejected ("not a valid
  TypeScript configuration loader") even though ESLint uses jiti for `eslint.config.ts`.
- `bunx jest` and `bun run test` run Jest on Node, which is what you want: Jest's VM sandbox is built for Node.
  The consequence is that specs must not call `Bun.*` APIs directly. Keep Bun-specific code behind a small
  interface and test the logic, or ask the user how they want to handle it.
- **`bun test` is Bun's own runner, not Jest.** It happily runs `*.spec.ts` files (the `describe`/`it`/`expect`
  globals look the same), so it looks like it works, but it skips ts-jest, coverage thresholds and the ratchet.
  `bun run test` (the package.json script) is the Jest entry point. Say this to the user; it is an easy trap.
- Jest is configured once at the root. `roots` is `<rootDir>` and `testMatch` limits discovery to
  `{packages,apps}/*/src/__tests__/**/*.spec.ts`; listing `packages/` and `apps/` in `roots` fails with "roots[n] was not
  found" while one of them does not exist yet. Coverage is aggregated
  globally, which is what the ratchet needs. Per-package Jest configs would split the ratchet into many files.

## Strict typing: what `no-explicit-any` alone misses

A probe file with five violations shows the difference. `no-explicit-any` catches only the explicit annotation.
The rest need type information, which comes from `tseslint.configs.strictTypeChecked` with `projectService`:

| Violation                         | Caught by                                    |
| --------------------------------- | -------------------------------------------- |
| `const x: any = ...`              | `no-explicit-any`                            |
| `const y = JSON.parse(s)` (`any`) | `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-return` |
| `// @ts-ignore`                   | `ban-ts-comment`                             |
| `maybe!.length`                   | `no-non-null-assertion`                      |
| `function f(x) {}`                | `tsc` (`noImplicitAny`, part of `strict`)    |

`verify.sh` re-creates this probe on every run and asserts each rule fires, so a config edit that silently
disarms a guard is caught. Parse untrusted data as `unknown` and narrow it (see `readTotals` in
`jest/jest.teardown.config.ts` for the pattern).

`tsconfig.base.json` goes beyond `strict` on purpose: `noUncheckedIndexedAccess` (array/record reads may be
`undefined`), `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
`verbatimModuleSyntax` (explicit `import type`, enforced by `consistent-type-imports`).

Files outside the packages (`eslint.config.ts` in the root, everything in `jest/`) are covered by the root
`tsconfig.json`; without that, `projectService` cannot type them and lint fails with a parsing error.

## Prettier and `.editorconfig`

`.editorconfig` is the single source of truth for indentation, line endings and line width. Prettier reads
`indent_style`, `indent_size`, `end_of_line` and `max_line_length` from it (verified: changing
`max_line_length` from 120 to 80 reformats code). `.prettierrc.json` therefore only holds style preferences that
`.editorconfig` cannot express (`singleQuote`, `trailingComma`). Do not add `printWidth` there: two sources drift.

`.gitattributes` (`* text=auto eol=lf`) enforces the `end_of_line = lf` promise at checkout time, which matters
on Windows. The lockfile is marked generated so it stays out of diffs.

Hand-written files rarely match Prettier exactly, so `add-package.sh` finishes with
`bun run format:fix`. Run it after any manual edit before `check`.

## Bun workspace details

- Workspaces are declared in the root `package.json` (`"workspaces": ["packages/*", "apps/*"]`); the lockfile is
  the text file `bun.lock`. Commit it and install in CI with `bun install --frozen-lockfile`. Adding a package
  directory by hand leaves `bun.lock` stale until `bun install` runs, and `--frozen-lockfile` then fails in CI.
- Bun installs workspaces in **isolated** mode by default: packages live in `node_modules/.bun/` and each
  workspace only sees the dependencies it declares, via symlinks (`bun install --linker hoisted` changes that).
  This is why `jest`, `typescript`, `eslint` and the `@types/*` packages sit in the root `devDependencies`:
  one version of each tool for every package, which is the requirement. Bun's guide keeps the root free of
  dependency fields in its minimal example; shared tooling at the root is a deliberate choice here.
- `bun add <pkg>` run inside a package directory adds the dependency to that package's `package.json` and updates
  the root lockfile. From the root, use `bun add -d <pkg>` for shared tooling. Guide:
  https://bun.com/guides/install/workspaces
- Sibling dependencies use `"@scope/name": "workspace:*"`; run `bun install` afterwards so the symlink exists.
- Internal packages expose TypeScript source directly (`"exports": { ".": "./src/index.ts" }`). That works for
  the typechecker (bundler resolution), for ts-jest (the symlink resolves outside `node_modules`, so it is
  transformed) and for Bun at runtime. Publishing a package to npm would need a build step: ask first.
- `bun run --filter '*' typecheck` runs each package's script; the root script then also typechecks root files.

## Decorators and the Playwright loader

There is no decorator in the command line. `experimentalDecorators` is `false` in `tsconfig.base.json`. A service
is a plain class, built by a factory the shell registers on a token.

- **`jest/jest.setup.ts` unrefs stdin** when it is a socket. No spec reads it, and a pipe or a terminal would
  otherwise show up as an open handle. From a file (`< /dev/null`) it is not a socket and holds nothing open.
- **Nothing the Playwright runner loads may use a decorator.** Playwright compiles `playwright.config.ts`,
  `shared/`, `reporters/` and what they import with its own Babel, which rejects parameter decorators
  (`UnsupportedParameterDecorator`). Every package has one entry, `.`, so that barrel stays free of them.
  `runner/src/__tests__/playwright-loaded.spec.ts` walks those imports and fails, naming the chain, if it reaches
  a decorator.
- **The runner's typecheck has no Bun types.** `createBunProcessSpawner` takes a structural function. The real
  `Bun.spawn` is read only in `packages/choliba/src/main.ts`, which the runner does not compile.

