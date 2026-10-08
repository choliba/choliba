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

/** The longest description a card shows without cutting it (X cuts at 200, search engines near 160). */
const DESCRIPTION_LENGTH = 160;

/** What a page's share card says about it. */
export interface SharePage {
  readonly siteName: string;
  readonly title: string;
  readonly description: string;
  readonly url: string;
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

/** The first paragraph of prose of `markdown`, after the frontmatter: headings, tables, lists, quotes and code skipped. */
function firstParagraph(markdown: string): string | undefined {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
  const blocks = body.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/);
  const prose = blocks.map((block) => block.trim()).find((block) => block !== '' && !/^([#|>-]|\d+\.\s)/.test(block));
  return prose === undefined ? undefined : prose.split('\n').map(plainText).join(' ');
}

/** `text` cut at the last word that fits in `DESCRIPTION_LENGTH`, with `…`. */
function cutAtWord(text: string): string {
  const cut = text.slice(0, DESCRIPTION_LENGTH - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:]+$/, '')}…`;
}

/** The sentences of `text`: each ends at a `.`, `!` or `?` followed by a space (so `agent.yaml` is not an end). */
function sentences(text: string): string[] {
  return (text.match(/.+?(?:[.!?:](?=\s|$)|$)/g) ?? []).map((sentence) => sentence.trim()).filter(Boolean);
}

/**
 * A page's description for its share card, from the text it already has: the whole sentences of its first
 * paragraph that fit in `DESCRIPTION_LENGTH` (the first one cut at a word if it alone does not). A last sentence
 * that ends in `:` introduces a list the card does not show, so it goes, or, when it is the only one, ends in `.`.
 * `undefined` for a page with no paragraph, such as the home.
 */
export function pageDescription(markdown: string): string | undefined {
  const paragraph = firstParagraph(markdown);
  if (paragraph === undefined) return undefined;
  const kept: string[] = [];
  for (const sentence of sentences(paragraph)) {
    if ([...kept, sentence].join(' ').length > DESCRIPTION_LENGTH) break;
    kept.push(sentence);
  }
  if (kept.length === 0) return cutAtWord(paragraph);
  if (kept.length > 1 && kept.at(-1)?.endsWith(':') === true) kept.pop();
  return kept.join(' ').replace(/:$/, '.');
}

/** A `<meta property>` tag, the attribute Open Graph uses (not `name`). */
function property(name: string, content: string): HeadConfig {
  return ['meta', { property: name, content }];
}

/**
 * The tags that make a link to the page a card on WhatsApp, LinkedIn, X, Discord, Slack and Facebook: the Open
 * Graph ones (https://ogp.me/) with the image's size, type and alt, X's `twitter:card` (its title, description and
 * image fall back to the `og:` ones) and the canonical URL, the same as `og:url`.
 */
export function shareTags(page: SharePage): HeadConfig[] {
  return [
    property('og:type', 'website'),
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
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'canonical', href: page.url }],
  ];
}
