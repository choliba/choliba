---
name: cli-guidelines
description: Design rules for choliba's command line, based on the Command Line Interface Guidelines (clig.dev) and adapted to this repo — help text, stdout vs stderr, exit codes, color and TTY detection, flags and their standard names, prompts, dry runs, errors, signals, configuration precedence, secrets and future-proofing. Use when adding or changing any `choliba` command, subcommand, flag, help text, error message, prompt or terminal output, when reviewing CLI code, or when someone asks how a command should behave, what a flag should be called, or where output should go.
argument-hint: 'The command, flag or output you are designing or reviewing.'
user-invocable: true
disable-model-invocation: false
---

# CLI guidelines

The choliba CLI is used by people at a terminal and by agents and scripts that read its output. Its one reference
is [clig.dev](https://clig.dev/) (the full checklist is in `references/clig-checklist.md`), followed by default:
what clig.dev says holds unless this file says otherwise. POSIX and the GNU standards are not references; what
choliba needs from them clig.dev already says, except `--`, which is rule 15.

Two lists keep the rest honest. **Deliberate departures** from clig.dev are in "Where choliba departs from
clig.dev" below, each with its reason; a new one is decided with the user and written there. **Gaps**, what
clig.dev asks and choliba does not do yet, are in `references/current-gaps.md`; check it before saying a behavior
already exists, and remove a line when it is closed.

## The rules choliba applies on every command

1. **Primary output to stdout; errors, progress and messages to stderr.** An agent or script piping a command
   must get only the result on stdout. Never print a warning to stdout.
2. **Exit 0 on success, non-zero on failure**, including usage errors. A command that found problems (a red
   gate, a failed `check`) fails with non-zero even if it printed a report.
3. **`-h`, `--help` and `choliba help <command>` all work** and print the help in pt-BR from the command's
   `CommandSpec` (`formatHelp` in `packages/core/src/cli/help.ts`); help ignores every other flag. A command
   missing a required argument prints a short usage plus "Run '... --help' for usage" on stderr and exits 1.
4. **Lead help with examples**, the most common use first. Every command and flag has a description; every new
   flag also reaches autocomplete (`complete` in `packages/core/src/help/complete.ts`).
5. **Flags over positional arguments.** At most one positional kind per command (a project, a ticket, a task
   text). Every flag has a long name; a one-letter alias only for the most used ones. Prefer the standard
   names: `--help`, `--version`, `--dry-run`, `--force`, `--json`, `--quiet`, `--no-input`, `--no-color`,
   `--output`. Never reuse a standard name with another meaning.
6. **Color only for humans.** Color is off when stdout is not a TTY, `NO_COLOR` is set and non-empty,
   `TERM=dumb` or `--no-color` is passed; `FORCE_COLOR` forces it on. Decide once, centrally, and pass the
   decision down (`ThemeService` and its `Theme`), never test the environment deep in rendering code. No spinners or live regions
   when stdout is not a TTY.
7. **Prompts only on a TTY, never required.** Every prompted value can also come from a flag. When stdin is not a
   TTY, or `--no-input` is passed, skip the prompt and fail with a message naming the flag to use.
8. **Dangerous actions are confirmed or previewable.** Anything that deletes or overwrites user files offers
   `--dry-run` (describe, write nothing) and asks before doing it on a TTY; `--force` skips the question.
9. **Errors are for humans, in pt-BR**: what went wrong, the path or value involved, and how to fix it ("Projeto
   "x" não encontrado (…/config.json não existe). Veja os projetos com `bunx choliba list projects`."). The most
   important line last; no stack trace unless it is an unexpected error, which goes with a hint to report it.
10. **Say what changed and what comes next.** A command that changes state prints the new state briefly and
    suggests the next command of the workflow (`generate ticket` → run the `product-owner`).
11. **Configuration precedence: flags > process environment > workspace `.env` > defaults** (already what
    `loadRepoConfig` does in `packages/core/src/config/repo-config.ts`). Environment variable names are uppercase
    with underscores and prefixed (`CHOL_*`) unless they are general-purpose ones (`NO_COLOR`, `TERM`,
    `PAGER`, `TMPDIR`...).
12. **No secrets in flags.** Credentials live in files (`.env.json` of a project, the workspace `.env`); never
    add a flag that takes a password or token, since it leaks into `ps` and shell history.
13. **Ctrl-C works.** Forward SIGINT/SIGTERM to child processes (as `runAgent` and `terminal run` do), print
    something at once, clean up with a bound on time, and leave nothing half-written that the next run cannot
    recover from.
14. **Changes are additive.** Add flags instead of changing what an existing one does; deprecate with a warning
    that says what to use instead before removing. Human-readable output may change; anything scripts or agents
    parse goes behind `--json` and stays stable.
15. **`--` ends the options.** Everything after it is an operand, even when it starts with `-`, and goes on as
    typed (`choliba terminal run --label x -- <command…>`).
16. **No catch-all, verbs at the root.** The root has a few verbs and commands (`run`, `add`, `new`, `list`,
    `check`, `setup`, `lint`, `format`, `help`, `version`); a command is reached as `verb type` (`run agent`,
    `run tests`, `new project`, `list agents`) or by its own word. A word the root, a verb or the agent runner does
    not know is a usage error, in pt-BR, that suggests the closest name (`unknownWordMessage` in
    `packages/core/src/help/suggest.ts`): `comando desconhecido: chek. Você quis dizer "check"?`. Subcommands are
    never abbreviated.

## Where choliba departs from clig.dev

Each on purpose, with its reason. Anything else clig.dev says applies.

| clig.dev says | choliba does | Why |
| --- | --- | --- |
| `noun verb` is the more common order | `verb noun` everywhere (`run agent`, `new project`, `list projects`) | The root stays a handful of stable verbs, and `run` covers agents and tests alike |
| Use an argument parsing library | Each command reads its words from `ShellIo` against a `CommandSpec` | One spec gives the help, the completion and `__describe`; no library does all three |
| Messages in the user's language | Help, messages and errors in pt-BR; the help's frame (`Usage:`, `Options:`, `Run '…' for usage.`) in English | The frame follows docker and git, which users already read |
| `--help` shows the command's help | `lint` and `format` pass every argument, `--help` included, to ESLint and Prettier | They are those tools with choliba's configuration; their own help is the useful one |
| Warn before a non-additive change, saying how to migrate | Before 1.0, a renamed command goes without an alias; the release notes say how to migrate (`BREAKING CHANGE:`) | A pre-release keeps no compatibility, and an alias would keep the old name alive |
| Do not read secrets from environment variables | The provider's credentials come from the environment or the workspace `.env` (`CLAUDE_CODE_OAUTH_TOKEN`, `CURSOR_API_KEY`) | That is how Claude Code and the Cursor CLI read them; choliba passes them on |
| Distribute a single binary | A Bun package (`.tgz`) installed in the workspace | The workspace pins the version, and the runner needs Playwright next to it |

## Checklist for a new or changed command

- [ ] stdout only has the result; everything else is on stderr
- [ ] exit codes: 0 success, 1 failure or usage error, covered by a spec
- [ ] `--help` text in pt-BR with an example; flags described; autocomplete updated
- [ ] flag names are standard where a standard exists; long form always present
- [ ] color and prompts respect TTY, `NO_COLOR`, `TERM=dumb`, `--no-color`, `--no-input`
- [ ] destructive effects have `--dry-run` and confirmation or `--force`
- [ ] errors say what, where and how to fix, in pt-BR
- [ ] a new command is a type under a verb when it is one (`run`, `new`, `list`); an unknown word suggests the
      closest name; no secret taken from a flag
- [ ] a new departure from clig.dev is decided with the user and added to "Where choliba departs from clig.dev"
- [ ] README's CLI section updated (see the `documentation` skill)
