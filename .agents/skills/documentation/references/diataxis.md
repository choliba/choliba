# Diátaxis in practice

Source: <https://diataxis.fr/>. Diátaxis sorts documentation by the reader's need along two axes — *acquiring*
skill vs. *applying* it, and *doing* vs. *knowing* — which gives four types. Each type has its own purpose, form
and failure modes.

## Tutorial — learning by doing

- **For:** a newcomer who wants to become able to work with the project.
- **Form:** a lesson with one path, concrete steps, and a visible result at every stage ("you should now see...").
  The author is responsible for the reader's success, so the path must be safe and tested.
- **Avoid:** offering choices, explaining theory mid-lesson, depending on things the reader has not set up.
- **Smell:** "Alternatively, you can..." — that belongs in a how-to guide.

## How-to guide — getting a task done

- **For:** someone who already knows the basics and has a goal ("add a new agent", "rotate the API key").
- **Form:** title as the goal, prerequisites, numbered steps, the expected outcome. Real-world conditions and
  variations are fine; teaching is not.
- **Avoid:** explaining concepts from scratch (link to the explanation instead); covering every option (that is
  reference).
- **Smell:** paragraphs of background before the first step.

## Reference — looking things up

- **For:** someone in the middle of work who needs an exact fact: a flag, a field, a default, an error.
- **Form:** mirrors the structure of the thing described (one section per command, one row per field); complete,
  accurate, neutral, consistent in shape. Tables and lists fit well.
- **Avoid:** instructions and opinions; incomplete lists ("some of the options are...").
- **Smell:** a reference entry that needs a story to make sense — the story is an explanation.

## Explanation — understanding

- **For:** someone who wants to know why things are the way they are.
- **Form:** discursive: context, history, design decisions, trade-offs, alternatives considered, how the parts fit.
  Can hold opinions and connect topics.
- **Avoid:** step-by-step instructions and exhaustive facts.
- **Smell:** a numbered list of commands — that is a how-to guide.

## Classifying an existing page

Ask of each section: is the reader *doing* or *thinking*? Are they *learning* or *working*? Sections that answer
differently belong in different pages. Split them and cross-link ("To understand why, see ...", "For every
option, see ...").

## Mapping to a small project

Small projects rarely need four separate trees. A common, honest shape:

- `README.md` — a quick start (a tiny tutorial) plus links;
- one page per area, each organized as how-to sections with a reference section (tables of commands, flags,
  config keys) at the end;
- explanation where a design is non-obvious, often as ADRs.

What matters is that each *section* has one type, not that the folder tree has four branches.
