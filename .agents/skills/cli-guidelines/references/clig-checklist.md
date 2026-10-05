# clig.dev checklist

A condensed version of the [Command Line Interface Guidelines](https://clig.dev/), section by section. Read the
original for the reasoning; `SKILL.md` says which rules choliba applies and how.

## Contents

- Philosophy
- Basics
- Help and documentation
- Output
- Errors
- Arguments and flags
- Interactivity
- Subcommands
- Robustness
- Future-proofing
- Signals
- Configuration and environment variables
- Naming, distribution, analytics

## Philosophy

Human-first design; simple parts that compose (stdin/stdout/stderr, exit codes, signals, plain text, JSON);
consistency with existing conventions; say just enough; ease of discovery; the CLI as a conversation (suggest
corrections, confirm risky steps, show state); robustness, both real and perceived; empathy; break a rule only
with a clear reason.

## Basics

- Use an argument parsing library.
- Exit 0 on success, non-zero on failure.
- Primary output to stdout; logs, errors and messages to stderr.

## Help and documentation

- `-h` and `--help` show help; `help` and `help <subcommand>` too in git-like tools. Help ignores other flags.
- A command missing required arguments shows concise help: description, one or two examples, main flags, a
  pointer to `--help`.
- Full help leads with examples and the most used flags; links to web docs and to where to get support.
- Suggest a correction for a likely typo, but do not run the corrected command silently.
- A command that reads stdin and finds a TTY shows help instead of hanging.
- Provide web docs; terminal docs (`help`) are a plus.

## Output

- Human-readable first; detect a TTY to know whether a human is reading.
- Machine-readable where it costs nothing: `--plain` (one record per line), `--json`.
- On success, print something brief; `-q`/`--quiet` silences the non-essential.
- After a state change, say what happened and the new state; make the current state easy to see; suggest the
  next command.
- Make crossing the program's boundary explicit (reading files not passed in, network calls).
- Color with intention. Disable it when stdout/stderr is not a TTY, `NO_COLOR` is set and non-empty,
  `TERM=dumb`, or `--no-color` is passed (optionally a `MYAPP_NO_COLOR`).
- No animations when stdout is not a TTY.
- Symbols and emoji only where they add structure.
- No developer-only debug output by default; stderr is not a log file (no level prefixes unless verbose).
- Page long output (`less -FIRX`) when stdout is a TTY.

## Errors

- Catch expected errors and rewrite them for humans, with how to fix them.
- High signal-to-noise: group repeated errors under one header; the most important information last; red only
  where it matters.
- For unexpected errors: debug info (ideally in a file) and how to report the bug, made easy.

## Arguments and flags

- Prefer flags to positional arguments; several positionals only for the same kind of thing (`rm a b c`) or a
  very common two-argument form (`cp src dst`).
- Every flag has a long form; one-letter flags only for the most common.
- Standard names: `-a/--all`, `-d/--debug`, `-f/--force`, `--json`, `-h/--help` (only help), `-n/--dry-run`,
  `--no-input`, `-o/--output`, `-p/--port`, `-q/--quiet`, `-u/--user`, `--version`; avoid `-v` (verbose or
  version?).
- Make the default right for most users.
- Prompt for missing input, but never require prompting; skip prompts when stdin is not a TTY.
- Confirm danger by severity: mild (maybe), moderate (prompt, offer `--dry-run`), severe (type the name or pass
  `--confirm=<name>`).
- Accept `-` for stdin/stdout where files are expected.
- A special word (`none`) for "no value" instead of an empty value.
- Order-independent flags and subcommands where possible.
- Never read secrets from flags; use a file (`--password-file`) or stdin.

## Interactivity

- Prompt only when stdin is a TTY; with `--no-input`, never prompt and fail naming the flag.
- No echo for passwords.
- Make escaping obvious; Ctrl-C must work.

## Subcommands

- Same flag names and output style across subcommands.
- One naming order for nested commands (noun verb or verb noun), used everywhere.
- No confusingly similar names (`update` and `upgrade`).

## Robustness

- Validate input early.
- Responsive over fast: print something within ~100 ms, especially before network calls.
- Show progress for long work; be careful with parallel output.
- Time out network operations.
- Recoverable: re-running after an interruption continues.
- Crash-only: little cleanup on exit, deferred to the next run.
- Expect misuse: scripts, bad networks, many instances, odd environments.

## Future-proofing

- Keep changes additive; warn before non-additive ones, saying how to migrate.
- Human output may change; scripts should use `--plain`/`--json`.
- No catch-all subcommand; no implicit abbreviations of subcommands (explicit aliases only).
- No time bombs: no hard dependency on services that may disappear; no blocking analytics.

## Signals

- On Ctrl-C, say something immediately and exit as soon as possible; bound cleanup with a timeout.
- On a second Ctrl-C during cleanup, skip the rest and say so.

## Configuration and environment variables

- Per-invocation settings: flags (and maybe env vars). Per-user/project settings: flags and env vars (maybe
  `.env`). Project settings under version control: a config file.
- Precedence: flags > shell environment > project config (`.env`) > user config > system config.
- Follow XDG (`~/.config`). Ask before modifying config the program does not own; prefer a separate file.
- Env var names: uppercase letters, digits, underscores; single-line values; avoid POSIX names.
- Honour general-purpose vars: `NO_COLOR`, `FORCE_COLOR`, `DEBUG`, `EDITOR`, `HTTP(S)_PROXY`, `NO_PROXY`,
  `SHELL`, `TERM`, `TMPDIR`, `HOME`, `PAGER`, `LINES`, `COLUMNS`.
- `.env` is fine for local project settings but not a substitute for a config file.
- Do not read secrets from environment variables; use files, pipes or a secrets manager.

## Naming, distribution, analytics

- Name: a short, memorable, lowercase word (dashes allowed), easy to type, not generic.
- Distribute as a single binary or a native package; document uninstall.
- No telemetry without consent; be explicit about what is collected; prefer opt-in.
