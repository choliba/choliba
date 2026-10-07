import { frontmatterPage } from '../libs/docs-home';

describe('frontmatterPage', () => {
  it('writes the data as the frontmatter of an empty page, quoting what YAML would misread', () => {
    const page = frontmatterPage({ layout: 'home', hero: { text: 'a: b', tagline: '--dry-run' } });

    expect(page).toBe(
      '---\n{\n  "layout": "home",\n  "hero": {\n    "text": "a: b",\n    "tagline": "--dry-run"\n  }\n}\n---\n',
    );
  });
});
