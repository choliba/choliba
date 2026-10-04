# TypeScript 6, decorators and DI

Nest's injection reads constructor parameter types from metadata that TypeScript emits only with legacy
decorators. choliba's strict `tsconfig.base.json` was not written with that in mind, so a few things must be set
up deliberately. Items marked **verify** were reasoned from the docs, not yet run here: check them on the first
Nest package and update this file with what actually happened (as `quality-gates/references/tooling-notes.md`
does).

## Contents

- tsconfig of a Nest package
- Imports and `verbatimModuleSyntax`
- Jest (ts-jest) needs the same flags
- Running under Bun
- Strict options that show up in Nest code

## tsconfig of a Nest package

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

Only the Nest package gets these; the CLI packages keep plain TypeScript. **Verify** that TypeScript 6.0.3 accepts
both options without a deprecation warning (`bunx tsc --noEmit -p apps/<name>/tsconfig.json`).

`main.ts` starts with `import 'reflect-metadata';` before anything from `@nestjs/*`.

## Imports and `verbatimModuleSyntax`

A class injected through the constructor must be imported as a **value**:

```ts
import { ProjectsService } from './projects.service'; // right
import type { ProjectsService } from './projects.service'; // compiles, but DI sees `Object` and fails at runtime
```

`consistent-type-imports` (in `eslint.config.ts`) does not report files that contain decorators when both
decorator flags are on, and with `projectService` it reads them from the package's tsconfig on its own. So lint
will not push you to `import type` there, but it will not stop you either: an editor's "organize imports" can
still do it. Interfaces and type aliases injected with `@Inject(TOKEN)` are the exception: they have no runtime
value, so they need an explicit token (a `Symbol` or string exported next to the type).

## Jest (ts-jest) needs the same flags

`jest/jest.config.ts` uses the `ts-jest` preset, which compiles every spec with the **root** `tsconfig.json`.
That file has no decorator flags, so under Jest the metadata is missing and `Test.createTestingModule` fails with
"Nest can't resolve dependencies". **Verify** and fix it in the Jest config, scoped to the Nest package, for
example a `transform` entry ahead of the default one:

```ts
transform: {
  '^.+/apps/api/src/.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/apps/api/tsconfig.json' }],
  '^.+\\.tsx?$': 'ts-jest',
},
```

This touches a gate config: follow the `quality-gates` skill and confirm `verify.sh` still passes.

## Running under Bun

`bun apps/<name>/src/main.ts` transpiles with Bun, which honours `experimentalDecorators` and
`emitDecoratorMetadata` from tsconfig. **Verify** that Bun picks up the package's `tsconfig.json` when started from
the repo root; if it does not, start from the package directory (`bun run --cwd apps/<name> src/main.ts`).
Jest runs on Node, so keep `Bun.*` calls behind an interface (same rule as `add-workspace-package`).

## Strict options that show up in Nest code

- `noPropertyAccessFromIndexSignature`: `req.headers['x-id']`, not `req.headers.xId`; prefer `@Headers('x-id')`.
- `exactOptionalPropertyTypes`: an optional DTO field is `name?: string`; do not assign `undefined` to it
  explicitly, omit it.
- `noUncheckedIndexedAccess`: route params and query values are `string | undefined` until a pipe narrows them.
  Use `ParseIntPipe`, `ParseUUIDPipe` or a custom pipe returning a typed value; never `as`.
- `strictPropertyInitialization`: a DTO field without an initializer does not compile, and `field!: string` is
  banned. Give DTOs a constructor and build them in the pipe from the narrowed input.
