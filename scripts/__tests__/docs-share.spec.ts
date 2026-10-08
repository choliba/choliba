import { pageDescription, pageUrl, shareTags, SITE_URL } from '../libs/docs-share';

describe('pageUrl', () => {
  it('serves a page without .md, an index as its folder', () => {
    expect(pageUrl('index.md')).toBe(`${SITE_URL}/`);
    expect(pageUrl('indice.md')).toBe(`${SITE_URL}/indice`);
    expect(pageUrl('guias/dry-run.md')).toBe(`${SITE_URL}/guias/dry-run`);
    expect(pageUrl('guias/index.md')).toBe(`${SITE_URL}/guias/`);
  });
});

describe('pageDescription', () => {
  it('takes the first paragraph as plain text: links as their text, no code or emphasis marks', () => {
    const page = '# Título\n\nUm agente é uma pasta `.choliba/agents/<id>/` com o **[`agent.yaml`](a.md)**.\n';
    expect(pageDescription(page)).toBe('Um agente é uma pasta .choliba/agents/<id>/ com o agent.yaml.');
  });

  it('skips the frontmatter, headings, tables, lists, quotes and code to reach the prose', () => {
    const page = [
      '---\ntitle: x\n---',
      '# Título',
      '## Seção',
      '| a | b |\n| - | - |',
      '- item',
      '1. passo',
      '> nota',
      '```\ncódigo\n\nmais\n```',
      'O texto\nem duas linhas.',
    ].join('\n\n');
    expect(pageDescription(page)).toBe('O texto em duas linhas.');
  });

  it('keeps the whole sentences that fit in 160 characters, a dot inside a word not ending one', () => {
    const second = 'Segunda frase que não cabe mais '.repeat(6);
    const page = `# T\n\nO agent.yaml declara tudo. ${second}.\n`;
    expect(pageDescription(page)).toBe('O agent.yaml declara tudo.');
  });

  it('cuts a first sentence longer than 160 characters at a word, with an ellipsis', () => {
    const description = pageDescription(`# T\n\n${'palavra, '.repeat(30)}fim.\n`) ?? '';
    expect(description).toMatch(/^palavra, .*palavra…$/);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it('drops a last sentence that introduces a list, and ends with a dot one that is all there is', () => {
    expect(pageDescription('# T\n\nO choliba-cli ajuda. Ele:\n\n- cria\n')).toBe('O choliba-cli ajuda.');
    expect(pageDescription('# T\n\nO choliba restringe o que cada um alcança:\n\n- a\n')).toBe(
      'O choliba restringe o que cada um alcança.',
    );
  });

  it('is undefined for a page with no paragraph, such as the home', () => {
    expect(pageDescription('---\n{ "layout": "home" }\n---\n')).toBeUndefined();
  });
});

describe('shareTags', () => {
  const page = { siteName: 'choliba', title: 'Dry run', description: 'O que faria.', url: `${SITE_URL}/guias/dry-run` };

  it('gives the Open Graph tags as property, with the absolute image, its size, type and alt', () => {
    const tags = shareTags(page);
    const properties = new Map(
      tags.flatMap(([, attrs]) => (attrs['property'] === undefined ? [] : [[attrs['property'], attrs['content']]])),
    );
    expect(Object.fromEntries(properties)).toEqual({
      'og:type': 'website',
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
    });
  });

  it('asks X for the large card and names the canonical URL, the same as og:url', () => {
    const tags = shareTags(page);
    expect(tags).toContainEqual(['meta', { name: 'twitter:card', content: 'summary_large_image' }]);
    expect(tags).toContainEqual(['link', { rel: 'canonical', href: page.url }]);
  });
});
