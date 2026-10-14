import { mainLandmarkMessage, pagesWithoutOneMain } from '../libs/docs';

describe('pagesWithoutOneMain', () => {
  it('passes a page with one main, with or without attributes', () => {
    expect(
      pagesWithoutOneMain([
        { path: 'index.html', html: '<div id="app"><main><div class="VPHome"></div></main></div>' },
        { path: 'guias/a.html', html: '<div id="app"><main class="main"><h1>A</h1></main></div>' },
      ]),
    ).toEqual([]);
  });

  it('names a page with no main, or with two', () => {
    expect(
      pagesWithoutOneMain([
        { path: 'a.html', html: '<div id="app"><div class="VPHome"><h1>A</h1></div></div>' },
        { path: 'b.html', html: '<div id="app"><main></main><main></main></div>' },
        { path: 'c.html', html: '<div id="app"><mainframe></mainframe><main></main></div>' },
      ]),
    ).toEqual(['a.html', 'b.html']);
  });

  it('leaves out what the build did not render: the 404, which the browser renders, and a file of public/', () => {
    expect(
      pagesWithoutOneMain([
        { path: '404.html', html: '<body><div id="app"></div></body>' },
        { path: 'google1.html', html: 'google-site-verification: google1.html' },
      ]),
    ).toEqual([]);
  });
});

describe('mainLandmarkMessage', () => {
  it('lists the pages', () => {
    expect(mainLandmarkMessage(['index.html', '404.html'])).toBe(
      'Página sem exatamente um <main> (landmark-one-main): index.html, 404.html.',
    );
  });
});
