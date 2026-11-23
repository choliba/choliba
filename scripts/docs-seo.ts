/**
 * What the site (https://choliba.github.io/) says to search engines and to the
 * places a link is shared: the share card of each page (Open Graph and X), its
 * description, the Google tag, `robots.txt`, the favicon and the name of the
 * site. Pure data in, data out: `docs/.vitepress/config.ts` puts it in the
 * pages and writes the files (see the `documentation` skill).
 */

/** The `[tag, attributes, content?]` VitePress puts in a page's `<head>`. */
export type HeadTag = [
  tag: string,
  attributes: Record<string, string | boolean>,
  content?: string,
];

/** Where the site is published; the share tags need absolute URLs. */
export const SITE_URL = 'https://choliba.github.io';

/** What the site is: the description of its home, and the one of the pages that have none. */
export const SITE_DESCRIPTION =
  'Roda agentes de código (Claude Code, Codex, Cursor e modelos locais pelo Ollama) a partir de scripts TypeScript, sempre dentro de uma sandbox.';

/** Who writes the site, for `article:author` and `<meta name="author">`. */
const AUTHOR = 'choliba';

/**
 * The card image of every page: 1200×630 (1.91:1) and under 600 KB, the
 * limit WhatsApp sets. Its source is `docs/.vitepress/og-image.svg`.
 */
const IMAGE = {
  url: `${SITE_URL}/og-choliba.png`,
  width: '1200',
  height: '630',
  type: 'image/png',
  alt: 'A coruja do choliba ao lado do nome e da frase “Agentes de código, sempre numa sandbox”.',
} as const;

/** The favicon Google Search can show: a square PNG larger than 48px (SVG is not accepted). */
export const FAVICON = '/favicon.png';

/** What a page's share card says about it. */
export interface SharePage {
  readonly siteName: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  /** When the site was published, as `publishedTime` writes it. */
  readonly published: string;
}

/** A built page: its path in the site's output folder and its HTML. */
export interface BuiltPage {
  readonly path: string;
  readonly html: string;
}

/**
 * The URL a page of `docs/` is served at, with `cleanUrls`: `relativePath` is
 * the page's file, and an `index.md` is its folder.
 */
export function pageUrl(relativePath: string): string {
  const page = relativePath.replace(/\.md$/, '').replace(/(^|\/)index$/, '$1');
  return `${SITE_URL}/${page}`;
}

/** A Markdown line as plain text: links become their text, code and emphasis marks go. */
function plainText(line: string): string {
  return line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim();
}

/**
 * The quote (`> …`) that is the first block after a page's `# ` title, as
 * plain text with its lines joined; `undefined` when that block is not a quote.
 */
export function quoteUnderTitle(markdown: string): string | undefined {
  const afterTitle = markdown.replace(/^[\s\S]*?^# .*\n/m, '');
  const block = afterTitle.trim().split(/\n\s*\n/)[0] ?? '';
  const lines = block.split('\n');
  if (!lines.every((line) => line.startsWith('>'))) return undefined;
  return lines.map((line) => plainText(line.replace(/^>\s?/, ''))).join(' ');
}

/** A description shorter than this gets a warning from LinkedIn. */
export const DESCRIPTION_MIN = 100;
/** A description longer than this is cut by search engines (and X cuts at 200). */
export const DESCRIPTION_MAX = 160;

/**
 * A page's own description: the one in its frontmatter, otherwise the quote
 * under its title; `undefined` when it has neither.
 */
export function pageDescription(
  frontmatter: Readonly<Record<string, unknown>>,
  markdown: string,
): string | undefined {
  const own = frontmatter['description'];
  if (typeof own === 'string' && own.trim() !== '') return own.trim();
  return quoteUnderTitle(markdown);
}

/**
 * `description` as the description of `page`, or an error that names the
 * page: it must exist and fit between `DESCRIPTION_MIN` and `DESCRIPTION_MAX`
 * characters, so no card or search result has to cut it or repeat the site's.
 */
export function checkDescription(
  page: string,
  description: string | undefined,
): string {
  if (description === undefined) {
    throw new Error(
      `${page}: falta a descrição, uma citação (> …) logo abaixo do título`,
    );
  }
  if (
    description.length < DESCRIPTION_MIN ||
    description.length > DESCRIPTION_MAX
  ) {
    throw new Error(
      `${page}: a descrição tem ${String(description.length)} caracteres, e deve ter de ${String(DESCRIPTION_MIN)} a ${String(DESCRIPTION_MAX)}`,
    );
  }
  return description;
}

/** `date` in ISO 8601, in UTC and to the second (`2026-10-08T16:28:36Z`), the DateTime of Open Graph. */
export function publishedTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** A `<meta property>` tag, the attribute Open Graph uses (not `name`). */
function property(name: string, content: string): HeadTag {
  return ['meta', { property: name, content }];
}

/**
 * The tags that make a link to the page a card on WhatsApp, LinkedIn, X,
 * Discord, Slack and Facebook: the Open Graph ones (https://ogp.me/) with the
 * image's size, type and alt; the page as an `article`, the only type with an
 * author and a publication date, which LinkedIn shows; X's `twitter:card` (its
 * title, description and image fall back to the `og:` ones) and the canonical
 * URL, the same as `og:url`.
 */
export function shareTags(page: SharePage): HeadTag[] {
  return [
    property('og:type', 'article'),
    property('og:site_name', page.siteName),
    property('og:locale', 'pt_BR'),
    property('og:title', page.title),
    property('og:description', page.description),
    property('og:url', page.url),
    property('og:image', IMAGE.url),
    property('og:image:width', IMAGE.width),
    property('og:image:height', IMAGE.height),
    property('og:image:type', IMAGE.type),
    property('og:image:alt', IMAGE.alt),
    property('article:published_time', page.published),
    property('article:author', AUTHOR),
    ['meta', { name: 'author', content: AUTHOR }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'canonical', href: page.url }],
  ];
}

/** The icon link of every page: `docs/public/favicon.png`, 192×192. */
export function faviconLink(): HeadTag {
  return [
    'link',
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: FAVICON },
  ];
}

/**
 * The name Google may show next to the favicon. It belongs only on the home
 * page (https://developers.google.com/search/docs/appearance/site-names).
 * `homeUrl` is that page's canonical URL.
 */
export function websiteJsonLd(name: string, homeUrl: string): HeadTag {
  return [
    'script',
    { type: 'application/ld+json' },
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name,
      url: homeUrl,
    }),
  ];
}

/**
 * The Google tag (gtag.js) of a Google Analytics property, as Google gives it:
 * the library, loaded without blocking the page, and the call that starts
 * measuring.
 */
export function googleAnalyticsTags(id: string): HeadTag[] {
  return [
    [
      'script',
      {
        async: '',
        src: `https://www.googletagmanager.com/gtag/js?id=${id}`,
      },
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${id}');`,
    ],
  ];
}

/** The site's robots.txt: every crawler may read every page, and the sitemap is announced. */
export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

/** An opening `<main>` tag, with or without attributes. */
const MAIN_TAG = /<main[\s>]/g;

/** Where VitePress renders a page. The 404 leaves it empty, for the browser; a file of `public/` has none. */
const APP = '<div id="app">';

function renderedHere(html: string): boolean {
  return html.includes(APP) && !html.includes(`${APP}</div>`);
}

/**
 * The pages the build rendered that do not have exactly one main landmark,
 * which screen readers use to jump to the content (axe's `landmark-one-main`):
 * none, as the default theme's home had, or more than one.
 */
export function pagesWithoutOneMain(
  pages: readonly BuiltPage[],
): readonly string[] {
  return pages
    .filter(
      ({ html }) =>
        renderedHere(html) && (html.match(MAIN_TAG) ?? []).length !== 1,
    )
    .map(({ path }) => path);
}

/** Why the build stopped, naming the pages. */
export function mainLandmarkMessage(paths: readonly string[]): string {
  return `Página sem exatamente um <main> (landmark-one-main): ${paths.join(', ')}.`;
}
