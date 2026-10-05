# Nest concepts on the choliba workspace

| Nest (docs.nestjs.com)                                   | choliba                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| An app (`src/main.ts`, `AppModule`)                      | `packages/choliba` only: `main.ts` (wiring) and `app.module.ts` |
| A library (`libs/<lib>`, `@app/<lib>` via tsconfig paths) | `packages/<name>`, imported as `@choliba/<name>/nest`         |
| `nest-cli.json`, `nest build`, monorepo mode             | not used: Bun workspace, `bun run check`, `scripts/build.ts`  |
| A controller                                             | a command (`<feature>.command.ts`, nest-commander)           |
| `ConfigModule.forRoot({ isGlobal: true })`               | `PlatformModule.forRoot(platform)` (and `RuntimeModule`)      |
| `test/` folder, `jest-e2e.json`                          | `src/__tests__/`, the one root Jest config                    |
| `.spec.ts` next to the file                              | `src/__tests__/<feature>/<file>.spec.ts`                      |
