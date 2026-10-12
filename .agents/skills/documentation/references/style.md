# Style reference

Condensed from the Google developer documentation style guide (<https://developers.google.com/style/highlights>)
and the Microsoft Writing Style Guide (<https://learn.microsoft.com/style-guide/top-10-tips-style-voice>). When the
project has its own style guide, it wins; these fill the gaps.

## Voice and tone

- Conversational and direct, not casual and not formal: explain it as you would to a capable colleague.
- Address the reader as "you". Use active voice: the subject does the action ("The CLI writes the file").
- Present tense for how things work ("returns", not "will return").
- No marketing, no hype ("simply", "just", "easy", "powerful") — they add nothing and can make a struggling reader
  feel stupid.

## Structure

- Put the conclusion, the command or the answer first; context after.
- Headings: sentence case, describe the content, no trailing punctuation. Task headings start with a verb
  ("Configure the provider"); concept headings are noun phrases ("Permission model").
- Keep paragraphs short (1–4 sentences). One topic per paragraph.
- Numbered lists for sequences; bulleted lists for unordered items; tables when items share several attributes.
  Introduce a list with a complete sentence or a clear lead-in.
- Every step is one action. State the expected result when it is not obvious.

## Words

- Prefer the simple word: "use" over "utilize", "to" over "in order to", "can" over "is able to".
- Define a term the first time it appears, then use exactly that term everywhere. Do not alternate synonyms for
  the same concept.
- Avoid ambiguous pronouns ("it", "this") when more than one thing could be meant.
- Avoid Latin abbreviations when a plain phrase works ("for example" over "e.g." in running text).
- Write for a global audience: no idioms, no culture-specific references, no jokes that do not translate.

## Code and UI elements

- Code formatting for commands, flags, file names, paths, keys, values, environment variables and error text.
- Code blocks with a language tag. Show the command, then the relevant output, trimmed but real.
- Placeholders are explicit and consistent: `<project>`, `<ticket>`; explain them right after the block.
- Keep commands copy-pasteable: no prompt characters inside the block unless output is mixed in.

## Links

- Link text says where it goes ("see [Permissions](permissions.md)"), never "click here".
- Link to the single source of a fact instead of repeating it.
- Relative links within the repository, so they work in the editor, on the forge and in the published site.

## Accessibility

- Describe images and diagrams in text; do not put essential information only in an image.
- Do not rely on color or position alone ("the red button", "the box on the left").

## Before and after

> ~~In order to run the tests, the `test` script should be utilized, which will run Jest.~~
> Run the tests with `bun run test` (Jest).

> ~~It is possible to configure the provider using an environment variable if desired.~~
> To choose the provider, set `AGENTS_PROVIDER` to `claude` or `cursor`.
