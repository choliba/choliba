/** A built page: its path in the site's output folder and its HTML. */
export interface BuiltPage {
  readonly path: string;
  readonly html: string;
}

/** An opening `<main>` tag, with or without attributes. */
const MAIN_TAG = /<main[\s>]/g;

/** Where VitePress renders a page. The 404 leaves it empty, for the browser; a file of `public/` has none. */
const APP = '<div id="app">';

function renderedHere(html: string): boolean {
  return html.includes(APP) && !html.includes(`${APP}</div>`);
}

/**
 * The pages the build rendered that do not have exactly one main landmark, which screen readers use to jump to the
 * content (axe's `landmark-one-main`): none, as the default theme's home had, or more than one.
 */
export function pagesWithoutOneMain(pages: readonly BuiltPage[]): readonly string[] {
  return pages
    .filter(({ html }) => renderedHere(html) && (html.match(MAIN_TAG) ?? []).length !== 1)
    .map(({ path }) => path);
}

/** Why the build stopped, naming the pages. */
export function mainLandmarkMessage(paths: readonly string[]): string {
  return `Página sem exatamente um <main> (landmark-one-main): ${paths.join(', ')}.`;
}
