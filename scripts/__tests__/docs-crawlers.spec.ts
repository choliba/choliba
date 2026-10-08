import { robotsTxt } from '../libs/docs-crawlers';

describe('robotsTxt', () => {
  it('lets every crawler read everything and announces the sitemap', () => {
    expect(robotsTxt('https://site.dev')).toBe('User-agent: *\nAllow: /\n\nSitemap: https://site.dev/sitemap.xml\n');
  });
});
