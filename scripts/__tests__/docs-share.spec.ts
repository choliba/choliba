import { readFileSync } from 'node:fs';
import path from 'node:path';

import { description as siteDescription } from '../../docs/.vitepress/home';
import {
  checkDescription,
  googleSiteVerification,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  pageDescription,
  pageUrl,
  publishedTime,
  robotsTxt,
  shareTags,
  SITE_URL,
} from '../libs/docs-share';
import { readDocPages } from '../libs/docs-sidebar';

const DOCS = path.join(__dirname, '..', '..', 'docs');

describe('pageUrl', () => {
  it('serves a page without .md, an index as its folder', () => {
    expect(pageUrl('index.md')).toBe(`${SITE_URL}/`);
    expect(pageUrl('indice.md')).toBe(`${SITE_URL}/indice`);
    expect(pageUrl('guias/dry-run.md')).toBe(`${SITE_URL}/guias/dry-run`);
    expect(pageUrl('guias/index.md')).toBe(`${SITE_URL}/guias/`);
  });
});

describe('pageDescription', () => {
  it('is the quote right under the title, as plain text, its lines joined', () => {
    const page =
      '# Título\n\n> Um agente é uma pasta com o **[`agent.yaml`](a.md)**,\n> lido pelo choliba.\n\nTexto.\n';
    expect(pageDescription(page)).toBe('Um agente é uma pasta com o agent.yaml, lido pelo choliba.');
  });

  it('is undefined when the block under the title is not a quote, even with a quote further down', () => {
    expect(pageDescription('# Título\n\nTexto.\n\n> Uma citação no meio.\n')).toBeUndefined();
    expect(pageDescription('# Título\n\n## Seção\n\n> Citação.\n')).toBeUndefined();
    expect(pageDescription('# Título\n\n> Meia citação\ne meio parágrafo.\n')).toBeUndefined();
  });
});

describe('checkDescription', () => {
  const sized = (length: number): string => 'a'.repeat(length);

  it('gives back a description from DESCRIPTION_MIN to DESCRIPTION_MAX characters', () => {
    expect(checkDescription('x.md', sized(DESCRIPTION_MIN))).toBe(sized(DESCRIPTION_MIN));
    expect(checkDescription('x.md', sized(DESCRIPTION_MAX))).toBe(sized(DESCRIPTION_MAX));
  });

  it('names the page when the quote is missing, too short or too long', () => {
    expect(() => checkDescription('guias/x.md', undefined)).toThrow('guias/x.md: falta a descrição');
    expect(() => checkDescription('x.md', sized(DESCRIPTION_MIN - 1))).toThrow('x.md: a descrição tem 99 caracteres');
    expect(() => checkDescription('x.md', sized(DESCRIPTION_MAX + 1))).toThrow(
      'tem 161 caracteres, e deve ter de 100 a 160',
    );
  });
});

describe('the pages of docs/', () => {
  const pages = readDocPages(DOCS).filter((page) => page.file !== 'index.md');

  it.each(pages.map((page) => page.file))('%s opens with a description of 100 to 160 characters', (file) => {
    const source = readFileSync(path.join(DOCS, file), 'utf8');
    expect(() => checkDescription(file, pageDescription(source))).not.toThrow();
  });

  it('gives the home, which has no quote, a site description of the same size', () => {
    expect(() => checkDescription('home', siteDescription)).not.toThrow();
  });

  it('have a title each, unique and of at most 60 characters', () => {
    const titles = pages.map((page) => page.title.replaceAll('`', ''));
    expect(pages.every((page) => page.title !== page.file)).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.filter((title) => title.length > 60)).toEqual([]);
  });
});

describe('publishedTime', () => {
  it('writes the date in ISO 8601, in UTC and to the second', () => {
    expect(publishedTime(new Date('2026-10-08T13:28:36.789-03:00'))).toBe('2026-10-08T16:28:36Z');
    expect(publishedTime(new Date())).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  });
});

describe('googleSiteVerification', () => {
  it('names the file after the token and writes the one line Google reads', () => {
    expect(googleSiteVerification('google0123abcd')).toEqual({
      name: 'google0123abcd.html',
      content: 'google-site-verification: google0123abcd.html',
    });
  });
});

describe('robotsTxt', () => {
  it('lets every crawler read everything and announces the sitemap', () => {
    expect(robotsTxt(SITE_URL)).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  });
});

describe('shareTags', () => {
  const page = {
    siteName: 'choliba',
    title: 'Dry run',
    description: 'O que faria.',
    url: `${SITE_URL}/guias/dry-run`,
    published: '2026-10-08T16:28:36Z',
  };

  it('gives the Open Graph tags as property: an article with its date and author, the absolute image, its size, type and alt', () => {
    const tags = shareTags(page);
    const properties = new Map(
      tags.flatMap(([, attrs]) => (attrs['property'] === undefined ? [] : [[attrs['property'], attrs['content']]])),
    );
    expect(Object.fromEntries(properties)).toEqual({
      'og:type': 'article',
      'og:site_name': 'choliba',
      'og:locale': 'pt_BR',
      'og:title': 'Dry run',
      'og:description': 'O que faria.',
      'og:url': `${SITE_URL}/guias/dry-run`,
      'og:image': `${SITE_URL}/og-choliba.png`,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
      'og:image:alt': expect.stringContaining('coruja') as string,
      'article:published_time': '2026-10-08T16:28:36Z',
      'article:author': 'choliba',
    });
  });

  it('asks X for the large card and names the canonical URL, the same as og:url', () => {
    const tags = shareTags(page);
    expect(tags).toContainEqual(['meta', { name: 'twitter:card', content: 'summary_large_image' }]);
    expect(tags).toContainEqual(['link', { rel: 'canonical', href: page.url }]);
    expect(tags).toContainEqual(['meta', { name: 'author', content: 'choliba' }]);
  });
});
