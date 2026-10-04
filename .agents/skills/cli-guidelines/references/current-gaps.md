# Where choliba does not follow the rules yet

Found on 2026-10-04 by reading the code on `develop`. Update this file when a gap is closed or a new one is
found; remove the line, do not mark it done.

| Rule (`SKILL.md`) | Today | Where |
|---|---|---|
| 6. Color only for humans | `colorize` defaults to `true`; only `--no-color` turns it off. `NO_COLOR`, `TERM=dumb` and a non-TTY stdout are not checked | `packages/agents/src/cli/args.ts` (`colorize`) |
| 6. Color decided centrally | Each CLI decides on its own; only the agents CLI has `--no-color` | `packages/agents/src/cli/args.ts`, `packages/terminal/src/cli/args.ts` |
| 5. Standard flags | No `--version` on `choliba` | `packages/choliba/src/route.ts` |
| 7. `--no-input` | Not supported; the one prompt (open the HTML report in `tests`) is already TTY-only | `packages/runner/src/cli/run-tests.ts` |
| 9. Typo suggestions | An unknown command or flag is reported without a "did you mean" | `packages/choliba/src/route.ts`, the per-CLI parsers |
| 1. stdout injected | `tests` writes through the global `writeStdout`/`writeStderr` instead of injected streams | `packages/runner/src/cli/run-tests.ts` |

What already follows the rules, for reference: pt-BR help from `CommandSpec`, dynamic autocomplete, `--dry-run`
on agents and `install`, SIGINT/SIGTERM forwarding with cleanup of the run folder (`runAgent`, `terminal run`),
flags over environment over `.env` (`loadRepoConfig`), credentials only in files.
