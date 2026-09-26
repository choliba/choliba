---
name: documentation
description: Industry practices for writing and maintaining technical documentation — deciding what kind of doc a reader needs (Diátaxis tutorials, how-to guides, reference, explanation), where it belongs, how to write it (Google/Microsoft developer style), keeping it true to the code (docs as code), READMEs, architecture decision records, changelogs, and docs that agents read (AGENTS.md, llms.txt). Use whenever you write, update, restructure or review docs, a README, a guide, a changelog, an ADR or an AGENTS.md, document a feature or a change after implementing it, or decide whether a change needs documentation at all — even if the request only says "update the docs" or "explain this in the README".
user-invocable: true
disable-model-invocation: false
---

# Documentation

Good documentation answers one reader's need, in the place they will look for it, with facts that are true of
the code today. Almost every documentation failure is one of those three going wrong: the wrong kind of text for
the need (a tutorial that turns into a reference dump), the right text in the wrong place (a new file nobody finds
while the existing page goes stale), or text that drifted from the code. The workflow below is built to prevent
each of them. It is tool- and project-agnostic: follow the project's own conventions wherever they exist, and use
these practices to fill the gaps.

## Workflow

1. **Start from the change, not from the docs.** Identify what actually changed for someone using the project:
   a new command, flag, config key, default, behavior or failure mode. Internal refactors, renames nobody sees,
   formatting and test-only changes usually need no documentation — say so explicitly instead of inventing text.
2. **Name the reader and their need**, then pick the document type (next section). One page serves one need.
3. **Find where it belongs before creating anything.** Read the existing docs and their structure. Prefer
   updating the page that already covers the topic over adding a new one; a new page is justified only when the
   topic is new *and* no existing page's purpose fits it. Keep the existing file names, headings and ordering.
4. **Verify every claim against the source of truth** — the code, the config schema, the command's real
   `--help`, the diff you were given. Never describe behavior from memory, from a plan, or from how it "probably"
   works. If you cannot verify something, leave it out or flag it as an open question.
5. **Write** following the style rules below, in the language the project's docs already use.
6. **Check** what the project's tooling checks (formatter, link checker, prose linter) and that every link,
   path, command and example still resolves.
7. **Report** what you changed, where, and why — and which changes you deliberately did not document.

## Picking the document type (Diátaxis)

| The reader wants to...     | Type         | Write it as                                                                   |
| -------------------------- | ------------ | ----------------------------------------------------------------------------- |
| learn, by doing, from zero | Tutorial     | A guided lesson with one safe path to a visible result; no choices, no detours |
| get a specific task done   | How-to guide | Numbered steps toward a goal, assuming competence; starts from the goal       |
| look up exact facts        | Reference    | Complete, accurate, neutral; structured like the thing it describes           |
| understand why / how       | Explanation  | Discussion of context, design decisions, trade-offs, alternatives             |

The most common mistake is mixing types in one page: a how-to that stops to explain history, or a reference that
turns into a tutorial. When a page needs two types, split it and link them. For the details and the typical
failure modes of each type, read `references/diataxis.md`.

## Writing style

Distilled from the Google developer documentation style guide and the Microsoft Writing Style Guide:

- **Lead with what matters.** The first sentence of a page or section says what it is for; the answer comes
  before the background.
- **Second person, active voice, present tense.** "Run `make build`", not "The build should be run".
- **Short and concrete.** Cut words that carry no information; prefer a real example over an abstract rule.
- **One idea per sentence, one topic per paragraph.** Use lists for sequences and options, tables for
  comparisons with several attributes.
- **Name things exactly as the reader sees them:** the real command, flag, file path, key and error message, in
  code formatting. Keep terms consistent — one name per concept across all pages.
- **Show real examples that work.** Copy commands and outputs from actual runs; never placeholders that look
  real. Mark what the reader must replace (`<project>`).
- **Sentence-case headings** that describe content ("Configure the provider"), so the table of contents reads
  as a summary.
- **Link instead of repeating.** A fact lives in one place; every other page links to it, so an update happens
  once.

More rules, word choices and examples: `references/style.md`.

## Keeping docs true (docs as code)

- Docs live in the repository, in plain text (usually Markdown), next to the code they describe.
- A change that affects users updates the docs **in the same change or pull request**, reviewed with the code.
  Docs written "later" are docs that drift.
- Automate what can be checked: formatting, broken links, prose style (e.g. Vale), examples that can run.
- Remove or rewrite what is no longer true. Outdated docs are worse than missing docs, because readers trust them.
- Generated docs (API reference from code comments, CLI help) should be generated, not copied by hand.

Checks and tooling notes: `references/docs-as-code.md`.

## Special documents

- **README** — the front door: what the project is, who it is for, how to install and run it in minutes, where
  to go next. Link to the docs instead of duplicating them.
- **Architecture decision record (ADR)** — one significant, hard-to-reverse decision per record: context,
  decision, consequences. Accepted records are not edited; a new record supersedes an old one.
- **Changelog** — for humans: grouped by version, newest first, with dates and the change types Added, Changed,
  Deprecated, Removed, Fixed, Security. Not a dump of commit messages.
- **Docs that agents read** (`AGENTS.md`, `llms.txt`, docs consumed by tools) — short, structured Markdown with
  exact commands and paths; grow them only when an agent keeps getting something wrong.

Templates and guidance for each: `references/special-documents.md`.

## Reporting back

End with a short account the reader of your work can check quickly:

- each file changed, with one line on what and why;
- anything in the change that you decided needs no documentation, and why;
- open questions or facts you could not verify.
