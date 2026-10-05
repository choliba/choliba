/** How a tool run in the background ended: its status (`null` when it did not start) and what it wrote to stderr. */
export interface CapturedRun {
  readonly status: number | null;
  readonly stderr: string;
}

/**
 * What the choliba app needs from Bun and the machine beyond `Platform`: running the tools it ships
 * (ESLint, Prettier, Playwright), finding them, and the deferred step of `setup`. Only `main.ts` builds the
 * real one; specs pass fakes to `RuntimeModule.forRoot`.
 */
export interface Runtime {
  /** The folder of the running entrypoint (`src/` from the sources, `bin/` once built), where lookups start. */
  readonly entryDir: string;
  /** The script being run (`process.argv[1]`), which the deferred `setup` runs again. */
  readonly script: string;
  /** Bun itself (`process.execPath`). */
  readonly execPath: string;
  readonly home: string;
  /** `Bun.resolveSync(specifier, entryDir)`: a file of a dependency of this package. */
  resolve(specifier: string): string;
  /**
   * Runs `command` in `cwd` with the terminal attached, with `env` on top of choliba's own environment;
   * resolves with its exit code (1 when it did not start).
   */
  run(command: string, args: readonly string[], cwd: string, env?: Readonly<Record<string, string>>): number;
  /** Runs `command` in `cwd`, keeping what it writes. */
  capture(command: string, args: readonly string[], cwd: string): CapturedRun;
  /** Starts `command` in `cwd` and leaves it running after choliba exits. */
  spawnDetached(command: readonly string[], cwd: string): void;
  sleep(ms: number): Promise<void>;
  /** Writes straight to the terminal (`/dev/tty`); false when there is none, as in CI. */
  writeTerminal(text: string): boolean;
}
