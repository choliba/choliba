---
name: nestjs
description: How NestJS fits into the choliba Bun monorepo — where a Nest app, module or shared "library" lives, how it wraps the existing framework-free packages, and the TypeScript 6 / DI / Jest traps that break the quality gates. Use when creating or reviewing NestJS code here (app, module, controller, provider, guard, pipe, interceptor, filter, DTO, a spec with @nestjs/testing), when asked where a Nest module should live or how to share one between apps, or when someone mentions `nest new`, `nest g`, `nest-cli.json`, Nest libraries/monorepo mode or docs.nestjs.com.
argument-hint: 'What you are building (app, module, provider...) and which @choliba packages it wraps.'
user-invocable: true
disable-model-invocation: false
---

# NestJS in choliba

NestJS gives choliba modules and dependency injection on top of the Bun workspace that already exists. It does
**not** replace the workspace: the Nest CLI "monorepo mode" (`nest-cli.json`, `libs/`, `@app/*` paths, one
`package.json`, `nest build`) is not used. Nest concepts are mapped onto `packages/*` and `apps/*` instead; the
table is in `references/workspace-mapping.md`.

## Where code goes

- **A Nest app is a workspace app.** Create it with
  `bash .agents/skills/add-workspace-package/scripts/add-package.sh <name> app` (see the `add-workspace-package`
  skill). `src/main.ts` only bootstraps (`NestFactory.create(AppModule)`, `listen`) and stays out of coverage;
  everything testable starts at `src/app.module.ts`.
- **The existing packages stay framework-free.** `core`, `projects`, `runner`, `agents` and `terminal` back the
  CLI and must not import `@nestjs/*`. A Nest module wraps them with thin providers that delegate to the existing
  functions, for example a `ProjectsService` whose methods call `listProjects` / `createProject` from
  `@choliba/projects`, receiving `ProjectLocations` through injection instead of reading config itself.
- **A Nest "library" is a workspace package.** While only one app uses a module, it lives in that app
  (`apps/<name>/src/<feature>/`). When a second app needs it, move it to `packages/<name>`, export `XxxModule`
  from `src/index.ts` and import it as `@choliba/<name>` (`workspace:*`). No build step, no tsconfig `paths`.
- **One feature per folder**: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, DTOs in
  `dto/`. Specs never sit next to them (see testing below).

## Steps

1. **Dependencies in the package that uses them.** From inside the app or package directory:
   `bun add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs` and
   `bun add -d @nestjs/testing supertest @types/supertest`. Never in the root `package.json`. Finish with
   `bun install` so `bun.lock` is current.
2. **Enable legacy decorators in that package only.** Its `tsconfig.json` adds `experimentalDecorators` and
   `emitDecoratorMetadata`; `tsconfig.base.json` does not change. Jest needs the same flags: read
   `references/typescript-and-di.md` before the first spec, it is the trap most likely to cost an afternoon.
3. **Write the failing spec first**, in `src/__tests__/`, then the module. Patterns in `references/testing.md`.
4. **No Nest CLI in the repo.** No `nest-cli.json`, no `@nestjs/cli` dependency. Write files by hand following
   the shapes above. If you do run `bunx @nestjs/cli g <schematic> <name> --flat --no-spec`, move the result
   into the conventions and delete anything it added to a `nest-cli.json`.
5. **Close with the gates**: `bun run check` and `bash .agents/skills/quality-gates/scripts/verify.sh`.

## Rules that carry over unchanged

- Hard typing: no `any`, no `!`, no `as` to silence a type. DTOs are classes with typed fields; request data is
  narrowed with pipes, not cast.
- Coverage only goes up: do not ask to exclude `*.module.ts`, controllers or providers from the ratchet. Building
  the testing module exercises them (see the `coverage-ratchet` skill).
- Prefer small providers and constructor injection; `object-calisthenics` applies to service logic.

## When the docs are needed

Answer Nest API questions from docs.nestjs.com, not from memory: `references/docs-map.md` lists the page for each
task. Anything there about `nest-cli.json`, `libs/` or `test/` folders is translated by
`references/workspace-mapping.md`.
