import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { commandsPage, guidePage, guidesIndexPage } from '../scripts/docs';
import {
  checkDescription,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  FAVICON,
  faviconLink,
  googleAnalyticsTags,
  mainLandmarkMessage,
  pageDescription,
  pagesWithoutOneMain,
  pageUrl,
  publishedTime,
  quoteUnderTitle,
  robotsTxt,
  shareTags,
  SITE_DESCRIPTION,
  SITE_URL,
  websiteJsonLd,
} from '../scripts/docs-seo';

const sized = (length: number): string => 'a'.repeat(length);
const read = (file: string): string => readFileSync(file, 'utf8');

describe('pageUrl', () => {
  test('serve a página sem .md e um index como a pasta dele', () => {
    expect(pageUrl('index.md')).toBe(`${SITE_URL}/`);
    expect(pageUrl('primeiros-passos.md')).toBe(`${SITE_URL}/primeiros-passos`);
    expect(pageUrl('guias/policy.md')).toBe(`${SITE_URL}/guias/policy`);
    expect(pageUrl('guias/index.md')).toBe(`${SITE_URL}/guias/`);
  });
});

describe('quoteUnderTitle', () => {
  test('é a citação logo abaixo do título, em texto puro e com as linhas juntas', () => {
    const page =
      '# Título\n\n> Um agente é uma pasta com o **[`agent.yaml`](a.md)**,\n> lido pelo choliba.\n\nTexto.\n';
    expect(quoteUnderTitle(page)).toBe(
      'Um agente é uma pasta com o agent.yaml, lido pelo choliba.',
    );
  });

  test('é undefined quando o bloco abaixo do título não é uma citação', () => {
    expect(
      quoteUnderTitle('# Título\n\nTexto.\n\n> Citação no meio.\n'),
    ).toBeUndefined();
    expect(
      quoteUnderTitle('# Título\n\n## Seção\n\n> Citação.\n'),
    ).toBeUndefined();
    expect(
      quoteUnderTitle('# Título\n\n> Meia citação\ne meio parágrafo.\n'),
    ).toBeUndefined();
  });
});

describe('pageDescription', () => {
  const page = '# Título\n\n> A citação.\n';

  test('prefere o frontmatter e depois a citação sob o título', () => {
    expect(pageDescription({ description: ' Do frontmatter. ' }, page)).toBe(
      'Do frontmatter.',
    );
    expect(pageDescription({}, page)).toBe('A citação.');
  });

  test('é undefined sem as duas, e ignora um description vazio ou que não é texto', () => {
    expect(pageDescription({}, '# Título\n\nTexto.\n')).toBeUndefined();
    expect(pageDescription({ description: '  ' }, page)).toBe('A citação.');
    expect(pageDescription({ description: 3 }, page)).toBe('A citação.');
  });
});

describe('checkDescription', () => {
  test('devolve uma descrição de DESCRIPTION_MIN a DESCRIPTION_MAX caracteres', () => {
    expect(checkDescription('x.md', sized(DESCRIPTION_MIN))).toBe(
      sized(DESCRIPTION_MIN),
    );
    expect(checkDescription('x.md', sized(DESCRIPTION_MAX))).toBe(
      sized(DESCRIPTION_MAX),
    );
  });

  test('nomeia a página quando falta a citação, ou ela é curta ou longa demais', () => {
    expect(() => checkDescription('guias/x.md', undefined)).toThrow(
      'guias/x.md: falta a descrição',
    );
    expect(() => checkDescription('x.md', sized(DESCRIPTION_MIN - 1))).toThrow(
      'x.md: a descrição tem 99 caracteres',
    );
    expect(() => checkDescription('x.md', sized(DESCRIPTION_MAX + 1))).toThrow(
      'tem 161 caracteres, e deve ter de 100 a 160',
    );
  });
});

describe('as páginas do site', () => {
  const courses = readdirSync('guides').filter((module) =>
    existsSync(`guides/${module}/README.md`),
  );

  test.each(courses)(
    'o curso %s abre com uma descrição de 100 a 160 caracteres',
    (module) => {
      const page = guidePage({
        module,
        markdown: read(`guides/${module}/README.md`),
      });
      expect(() =>
        checkDescription(module, pageDescription({}, page)),
      ).not.toThrow();
    },
  );

  test('a página dos cursos, a dos comandos, os primeiros passos e a home também', () => {
    const pages = {
      cursos: guidesIndexPage([]),
      comandos: commandsPage({}),
      'primeiros-passos': read('docs/primeiros-passos.md'),
    };
    for (const [name, markdown] of Object.entries(pages)) {
      expect(() =>
        checkDescription(name, pageDescription({}, markdown)),
      ).not.toThrow();
    }
    expect(() => checkDescription('home', SITE_DESCRIPTION)).not.toThrow();
  });
});

describe('publishedTime', () => {
  test('escreve a data em ISO 8601, em UTC e até o segundo', () => {
    expect(publishedTime(new Date('2026-10-08T13:28:36.789-03:00'))).toBe(
      '2026-10-08T16:28:36Z',
    );
  });
});

describe('shareTags', () => {
  const page = {
    siteName: 'Choliba',
    title: 'Primeiros passos',
    description: 'Instale o Choliba.',
    url: `${SITE_URL}/primeiros-passos`,
    published: '2026-10-08T16:28:36Z',
  };

  test('dá as tags Open Graph como property, com a imagem absoluta, o tamanho, o tipo e o alt', () => {
    const properties = shareTags(page).flatMap(([, attributes]) =>
      'property' in attributes
        ? [[String(attributes['property']), attributes['content']] as const]
        : [],
    );
    const { 'og:image:alt': alt, ...rest } = Object.fromEntries(properties);
    expect(alt).toContain('coruja');
    expect(rest).toEqual({
      'og:type': 'article',
      'og:site_name': 'Choliba',
      'og:locale': 'pt_BR',
      'og:title': 'Primeiros passos',
      'og:description': 'Instale o Choliba.',
      'og:url': `${SITE_URL}/primeiros-passos`,
      'og:image': `${SITE_URL}/og-choliba.png`,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
      'article:published_time': '2026-10-08T16:28:36Z',
      'article:author': 'choliba',
    });
  });

  test('pede o card grande ao X e dá a URL canônica, igual à og:url', () => {
    const tags = shareTags(page);
    expect(tags).toContainEqual([
      'meta',
      { name: 'twitter:card', content: 'summary_large_image' },
    ]);
    expect(tags).toContainEqual(['link', { rel: 'canonical', href: page.url }]);
    expect(tags).toContainEqual([
      'meta',
      { name: 'author', content: 'choliba' },
    ]);
  });
});

describe('faviconLink', () => {
  test('aponta para o PNG quadrado que o Google Search pode usar', () => {
    expect(faviconLink()).toEqual([
      'link',
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: FAVICON },
    ]);
  });
});

describe('websiteJsonLd', () => {
  test('dá o nome do site na home', () => {
    const [tag, attributes, content] = websiteJsonLd('Choliba', `${SITE_URL}/`);
    expect(tag).toBe('script');
    expect(attributes).toEqual({ type: 'application/ld+json' });
    expect(JSON.parse(String(content))).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Choliba',
      url: `${SITE_URL}/`,
    });
  });
});

describe('googleAnalyticsTags', () => {
  test('carrega o gtag.js da propriedade sem bloquear a página e depois começa a medir', () => {
    const [library, start] = googleAnalyticsTags('G-TEST123');
    expect(library).toEqual([
      'script',
      {
        async: '',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
      },
    ]);
    expect(start[0]).toBe('script');
    expect(start[2]).toContain('window.dataLayer = window.dataLayer || [];');
    expect(start[2]).toContain("gtag('config', 'G-TEST123');");
  });
});

describe('robotsTxt', () => {
  test('deixa todo rastreador ler tudo e anuncia o sitemap', () => {
    expect(robotsTxt('https://site.dev')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://site.dev/sitemap.xml\n',
    );
  });
});

describe('pagesWithoutOneMain', () => {
  test('passa a página com um main, com ou sem atributos', () => {
    expect(
      pagesWithoutOneMain([
        {
          path: 'index.html',
          html: '<div id="app"><main><div class="VPHome"></div></main></div>',
        },
        {
          path: 'a.html',
          html: '<div id="app"><main class="main"><h1>A</h1></main></div>',
        },
      ]),
    ).toEqual([]);
  });

  test('nomeia a página sem main ou com dois', () => {
    expect(
      pagesWithoutOneMain([
        { path: 'a.html', html: '<div id="app"><h1>A</h1></div>' },
        {
          path: 'b.html',
          html: '<div id="app"><main></main><main></main></div>',
        },
        {
          path: 'c.html',
          html: '<div id="app"><mainframe></mainframe><main></main></div>',
        },
      ]),
    ).toEqual(['a.html', 'b.html']);
  });

  test('deixa de fora o que o build não renderizou: a 404 e um arquivo de public/', () => {
    expect(
      pagesWithoutOneMain([
        { path: '404.html', html: '<body><div id="app"></div></body>' },
        {
          path: 'google1.html',
          html: 'google-site-verification: google1.html',
        },
      ]),
    ).toEqual([]);
  });
});

describe('mainLandmarkMessage', () => {
  test('lista as páginas', () => {
    expect(mainLandmarkMessage(['index.html', '404.html'])).toBe(
      'Página sem exatamente um <main> (landmark-one-main): index.html, 404.html.',
    );
  });
});
