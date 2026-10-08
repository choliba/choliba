import { googleAnalyticsTags } from '../libs/docs-analytics';

describe('googleAnalyticsTags', () => {
  it('loads gtag.js for the property without blocking the page, then starts measuring it', () => {
    const [library, start] = googleAnalyticsTags('G-TEST123');

    expect(library).toEqual(['script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST123' }]);
    expect(start?.[0]).toBe('script');
    expect(start?.[2]).toContain('window.dataLayer = window.dataLayer || [];');
    expect(start?.[2]).toContain("gtag('config', 'G-TEST123');");
  });
});
