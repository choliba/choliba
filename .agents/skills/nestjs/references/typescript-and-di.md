# TypeScript 6, decorators and DI

Verified on 2026-10-04 with TypeScript 6.0.3, ts-jest 29.4, Jest 30.5 and Bun 1.4.

## Decorators without metadata

`tsconfig.base.json` sets `experimentalDecorators` and **not** `emitDecoratorMetadata`. ts-jest compiles each file
on its own (`isolatedModules`), so emitted metadata becomes `typeof X !== "undefined" ? X : Object` for every
injected class: a branch that never runs and fails the coverage ratchet. So Nest cannot read constructor types,
and every dependency says what it is:

```ts
constructor(
  @Inject(ConfigService) private readonly config: ConfigService,
  @Inject(STDOUT) private readonly stdout: Writable,
) {}
```

A parameter without `@Inject` fails at `compile()` ("Nest can't resolve dependencies"), which the module's spec
catches. Interfaces and values get a token (`Symbol`) in `<feature>.constants.ts`.

`jest/jest.setup.ts` imports `reflect-metadata` (Nest's decorators store what they declare with it); `main.ts`
does too, first.

## Where decorators may not go

The Playwright runner compiles `packages/runner/playwright.config.ts`, `shared/`, `reporters/` and everything they
import with its own Babel, which rejects parameter decorators. That is why `@choliba/<pkg>` exports plain code and
`@choliba/<pkg>/nest` the decorated one. `packages/runner/src/__tests__/playwright-loaded.spec.ts` walks those
imports and fails, naming the chain, when it reaches a decorator.

## Strict options that show up in Nest code

- `exactOptionalPropertyTypes`: omit an optional field instead of assigning `undefined`.
- `noUncheckedIndexedAccess`: values from arrays and records are `T | undefined` until narrowed.
- `strictPropertyInitialization`: no `field!`; DTOs take their values in the constructor, built by a parse
  function that throws a usage error for a wrong command line.
