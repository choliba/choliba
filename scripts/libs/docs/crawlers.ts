/** The site's robots.txt: every crawler may read every page, and the sitemap is announced. */
export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
