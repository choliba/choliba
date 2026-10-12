import type { HeadConfig } from 'vitepress';

/**
 * The Google tag (gtag.js) of a Google Analytics property, as Google gives it: the library, loaded without
 * blocking the page, and the call that starts measuring. Pages the site changes to without a reload are counted by
 * the property's enhanced measurement ("page changes based on browser history events"), not here.
 */
export function googleAnalyticsTags(id: string): HeadConfig[] {
  return [
    ['script', { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${id}` }],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${id}');`,
    ],
  ];
}
