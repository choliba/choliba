import type { HeadConfig } from 'vitepress';

/**
 * The favicon Google Search can show: a square PNG larger than 48px. SVG is not one of the formats Google
 * accepts (https://developers.google.com/search/docs/appearance/favicon-in-search).
 */
export const FAVICON = '/favicon.png';

/** The icon link for every page. The file is `docs/public/favicon.png`, 192×192. */
export function faviconLink(): HeadConfig {
  return ['link', { rel: 'icon', type: 'image/png', sizes: '192x192', href: FAVICON }];
}

/**
 * The name Google may show next to the favicon. It belongs only on the home page
 * (https://developers.google.com/search/docs/appearance/site-names). `homeUrl` is that page's canonical URL.
 */
export function websiteJsonLd(name: string, homeUrl: string): HeadConfig {
  return [
    'script',
    { type: 'application/ld+json' },
    JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name, url: homeUrl }),
  ];
}
