import { FAVICON, faviconLink, websiteJsonLd } from '../libs/docs';

describe('faviconLink', () => {
  it('points at the square PNG Google Search can use', () => {
    expect(faviconLink()).toEqual(['link', { rel: 'icon', type: 'image/png', sizes: '192x192', href: FAVICON }]);
  });
});

describe('websiteJsonLd', () => {
  it('names the site on its home page', () => {
    const tag = websiteJsonLd('choliba', 'https://choliba.github.io/');

    expect(tag[0]).toBe('script');
    expect(tag[1]).toEqual({ type: 'application/ld+json' });
    expect(JSON.parse(String(tag[2]))).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'choliba',
      url: 'https://choliba.github.io/',
    });
  });
});
