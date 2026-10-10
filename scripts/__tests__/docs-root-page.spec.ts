import { rootPage } from '../libs/docs-root-page';

describe('rootPage', () => {
  it('puts the description, no previous or next page and no edit link in the frontmatter, above the page', () => {
    expect(rootPage('# Filosofia\n\n> Lema.\n', 'Por quê.')).toBe(
      '---\n{\n  "description": "Por quê.",\n  "prev": false,\n  "next": false,\n  "editLink": false\n}\n---\n\n# Filosofia\n\n> Lema.\n',
    );
  });

  it('points the links to docs/ inside the folder and the other files of the root one folder up', () => {
    const page = rootPage(
      'Veja [Segurança](docs/referencia/seguranca.md#a) e [CONTRIBUTING.md](CONTRIBUTING.md).',
      'd',
    );

    expect(page).toContain('[Segurança](referencia/seguranca.md#a) e [CONTRIBUTING.md](../CONTRIBUTING.md).');
  });

  it('leaves alone an anchor, an absolute path and another site', () => {
    const page = rootPage('[a](#topo) [b](/guias/x) [c](https://semver.org)', 'd');

    expect(page).toContain('[a](#topo) [b](/guias/x) [c](https://semver.org)');
  });

  it('drops the --- between sections', () => {
    expect(rootPage('Fim da seção.\n\n---\n\n## Próxima\n', 'd')).toContain('Fim da seção.\n\n## Próxima\n');
  });
});
