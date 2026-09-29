/** What a CLI answers to `__complete`: a list of words, or "let the shell complete file names". */
export type Suggestions = { readonly kind: 'values'; readonly values: readonly string[] } | { readonly kind: 'files' };

/** The value each flag typed so far on the command line got, by the flag's long name (the last one wins). */
export type TypedFlags = ReadonlyMap<string, string>;

export interface FlagValueSpec {
  /** Shown in `--help` after the flag, e.g. `string` in `--mode string`. */
  readonly name: string;
  /**
   * Computed on every completion, so the values always reflect the repository as it is now. Gets the
   * values of the flags already typed, so one flag can depend on another (`--ticket` on `--project`).
   */
  readonly suggest?: (typed: TypedFlags) => Suggestions;
}

export interface FlagChoice {
  readonly name: string;
  readonly description: string;
}

export interface FlagSpec {
  /** Long form, e.g. `--mode`. */
  readonly name: string;
  /** Short forms, e.g. `['-h']`. */
  readonly aliases?: readonly string[];
  readonly description: string;
  /** Present when the flag takes a value (`--mode plan`); absent for a boolean flag. */
  readonly value?: FlagValueSpec;
  /** The values the flag takes, each with what it means; `--help` lists them under the flag's description. */
  readonly choices?: readonly FlagChoice[];
  /** Keeps being suggested after it was already used (`--add-dir a --add-dir b`). */
  readonly repeatable?: boolean;
  /** Ends the command (`--help` prints and exits), so nothing is suggested after it. */
  readonly terminal?: boolean;
}

export interface CommandEntry {
  readonly name: string;
  readonly description: string;
  /** `--help` section title, e.g. `Commands` or `Agents`; entries keep their order inside it. */
  readonly group: string;
  readonly spec: CommandSpec;
  /** Also accepted as `--<name>`, e.g. `agents --docs-updater`. */
  readonly asFlag?: boolean;
}

/** One description of a CLI (or of one of its commands) that both `complete` and `formatHelp` read. */
export interface CommandSpec {
  /** Text after `Usage:`, e.g. `agents [OPTIONS] COMMAND [TASK...]`. */
  readonly usage: string;
  readonly description?: string;
  readonly commands?: () => readonly CommandEntry[];
  readonly flags?: readonly FlagSpec[];
  /**
   * Suggestions for the next positional argument, given the ones already typed after the command and
   * the word being typed (`demo:` for a CLI whose argument is `project:ticket`).
   */
  readonly positionals?: (previous: readonly string[], current: string) => Suggestions;
  /** Last line of `--help`. */
  readonly footer?: string;
}
