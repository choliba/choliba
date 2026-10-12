# Docs as code

Source: Write the Docs, <https://www.writethedocs.org/guide/docs-as-code/>. Treat documentation like source code:
plain text in version control, changed through the same review, checked automatically.

## Principles

- **Same repository, same change.** The pull request that changes behavior updates the docs that describe it.
  Reviewers check both together, which is the only reliable way to keep them in sync.
- **Plain text.** Markdown (or the format the project already uses), readable in a diff and in an editor.
- **Single source of truth.** A fact is written once and linked from everywhere else. Copies drift.
- **Generate what can be generated.** CLI `--help`, API reference from signatures and doc comments, config
  reference from a schema. Hand-written copies of generated facts go stale first.
- **Delete aggressively.** Outdated docs are worse than none: readers trust them. When behavior is removed,
  remove its documentation in the same change.

## Deciding whether a change needs docs

Needs documentation:

- new or changed commands, flags, options, config keys, environment variables, defaults;
- changed behavior a user can observe (output, exit codes, errors, files written);
- new setup steps, dependencies or requirements;
- removals and deprecations (say what replaces them);
- a non-obvious design decision others will have to live with (often an ADR).

Usually does not:

- internal refactors and renames invisible to users;
- formatting, test-only and tooling-internal changes;
- fixes that restore documented behavior (the docs were already right).

When in doubt, check whether a reader following the current docs would now be misled. If yes, update them.

## Automated checks

Run whatever the project already runs; common ones:

| Check        | What it catches                                   | Typical tools                  |
| ------------ | ------------------------------------------------- | ------------------------------ |
| Formatting   | inconsistent Markdown, tables, wrapping           | Prettier, markdownlint         |
| Links        | broken internal and external links, bad anchors   | lychee, markdown-link-check    |
| Prose style  | banned words, passive voice, terminology drift    | Vale (with a project style)    |
| Spelling     | typos, with a project word list                   | cspell, Vale                   |
| Examples     | commands and snippets that no longer run          | doctest-style runners, CI jobs |

If an edit tool or agent cannot run these, at least keep the output in a state the project's formatter accepts
and double-check every path and anchor by hand.

## Review checklist

- Does each changed page still serve one reader need (one Diátaxis type per section)?
- Is every command, flag, path, default and example verified against the current code?
- Do all links and anchors resolve? Were pages that referenced removed behavior updated?
- Is anything now duplicated that should be a link?
- Does the README still get a new user running?
