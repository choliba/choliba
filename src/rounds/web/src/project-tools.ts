/**
 * The project's own tools (`tools/*.ts`), read from their text,
 * never run (a tool brings its own packages, such as a browser). Each
 * `export const X = registerTool({ name: 'y', … })` is a tool the
 * definitions import as `X` and the records name `choliba/y`. Pure: the
 * files come from whoever has them (known-tools.ts, in the pages).
 */

/** A registered tool of the project, and how a definition reaches it. */
export interface ProjectTool {
  /** `choliba/fetch_web_content`: what the provider's tools and the policy name. */
  readonly name: string;
  /** `FETCH_WEB_CONTENT`: the export a definition imports. */
  readonly binding: string;
  /** `../../tools/fetch-web-content`: the import, from rounds/definitions. */
  readonly from: string;
  /** What the tool says it does: its own `description`. */
  readonly description: string;
}

/** Where a definition (rounds/definitions/<id>.ts) imports the tools from. */
const FROM_DEFINITIONS = '../../tools/';

/** `export const X = registerTool({ name: 'y'`, and the description after it. */
const REGISTERED =
  /export const (\w+)\s*=\s*registerTool\(\{\s*name:\s*'([^']+)'(?:,\s*description:\s*'((?:[^'\\]|\\.)*)')?/g;

/** The tools a file of tools registers, from its text. */
export function toolsOf(path: string, text: string): ProjectTool[] {
  const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.ts$/, '');
  return [...text.matchAll(REGISTERED)].map((match) => ({
    name: `choliba/${match[2] ?? ''}`,
    binding: match[1] ?? '',
    from: `${FROM_DEFINITIONS}${file}`,
    description: (match[3] ?? '').replaceAll("\\'", "'"),
  }));
}

/** The tools of every file (path → text), by file then by order in it. */
export const toolsOfFiles = (
  files: Readonly<Record<string, string>>,
): ProjectTool[] =>
  Object.entries(files)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .flatMap(([path, text]) => toolsOf(path, text));

/** `tools/<file>`, the end of an import of a tool, from wherever it is written. */
const TOOL_IMPORT = /(?:^|\/)tools\/([^/]+?)(?:\.[jt]s)?$/;

/**
 * The tools an import path of a definition gives: matched by its end,
 * `tools/<file>`, so a piece in a round's folder (`../../../tools/x`)
 * reaches the same tools as a definition alone (`../../tools/x`).
 */
export function toolsAt(
  tools: readonly ProjectTool[],
  path: string,
): readonly ProjectTool[] {
  const file = TOOL_IMPORT.exec(path)?.[1];
  if (file === undefined) return [];
  return tools.filter((tool) => tool.from.endsWith(`tools/${file}`));
}
