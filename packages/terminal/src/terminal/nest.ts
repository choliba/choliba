// Bun, which only an app's `main.ts` reads: kept out of `.`, which must load under Node (the Playwright runner).
export { createBunProcessSpawner, type BunSpawnFn } from './spawn';
