import type { HeadConfig } from 'vitepress';

/** Where the site is published; the share tags need absolute URLs. */
export const SITE_URL = 'https://choliba.github.io';

/** The card image of every page: 1200×630 (1.91:1) and under 600 KB, the limit WhatsApp sets. */
const IMAGE = {
  url: `${SITE_URL}/og-choliba.png`,
  width: '1200',
  height: '630',
  type: 'image/png',
  alt: 'A coruja do choliba ao lado do nome e da frase “Testes E2E operados por agentes”.',
} as const;

/** Who writes the site, for `article:author` and `<meta name="author">`. */
const AUTHOR = 'choliba';

/** A description shorter than this gets a warning from LinkedIn. */
export const DESCRIPTION_MIN = 100;
/** A description longer than this is cut by search engines (and X cuts at 200). */
export const DESCRIPTION_MAX = 160;

/** What a page's share card says about it. */
export interface SharePage {
  readonly siteName: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
  /** When the site was published, as `publishedTime` writes it. */
  readonly published: string;
}

/**
 * The URL a page of `docs/` is served at, with `cleanUrls`: `relativePath` is the page after the rewrites
 * (`indice.md`, not `README.md`), and an `index.md` is its folder.
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
 * A page's description: the quote (`> …`) that is the first block after its `# ` title, as plain text, its lines
 * joined. Every page of `docs/` opens with one, so the text is part of the page, on GitHub too, and not metadata.
 * `undefined` when the block after the title is not a quote.
 */
export function pageDescription(markdown: string): string | undefined {
  const afterTitle = markdown.replace(/^[\s\S]*?^# .*\n/m, '');
  const block = afterTitle.trim().split(/\n\s*\n/)[0] ?? '';
  const lines = block.split('\n');
  if (!lines.every((line) => line.startsWith('>'))) return undefined;
  return lines.map((line) => plainText(line.replace(/^>\s?/, ''))).join(' ');
}

/**
 * `description` as the description of `page`, or an error that names the page: the quote after the title must
 * exist and fit between `DESCRIPTION_MIN` and `DESCRIPTION_MAX` characters, so no card has to cut it.
 */
export function checkDescription(page: string, description: string | undefined): string {
  if (description === undefined) {
    throw new Error(`${page}: falta a descrição, uma citação (> …) logo abaixo do título`);
  }
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
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

/** A file the site serves at its root: its name and its content. */
export interface RootFile {
  readonly name: string;
  readonly content: string;
}

/**
 * The file that proves to Google Search Console that the site is ours (the "HTML file" method): served at the root
 * as `<token>.html`, with only `google-site-verification: <token>.html` in it.
 */
export function googleSiteVerification(token: string): RootFile {
  const name = `${token}.html`;
  return { name, content: `google-site-verification: ${name}` };
}

/** The site's robots.txt: every crawler may read every page, and the sitemap is announced. */
export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

/** A `<meta property>` tag, the attribute Open Graph uses (not `name`). */
function property(name: string, content: string): HeadConfig {
  return ['meta', { property: name, content }];
}

/**
 * The tags that make a link to the page a card on WhatsApp, LinkedIn, X, Discord, Slack and Facebook: the Open
 * Graph ones (https://ogp.me/) with the image's size, type and alt; the page as an `article`, the only type with an
 * author and a publication date, which LinkedIn shows; X's `twitter:card` (its title, description and image fall
 * back to the `og:` ones) and the canonical URL, the same as `og:url`.
 */
export function shareTags(page: SharePage): HeadConfig[] {
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
