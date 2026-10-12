/**
 * A VitePress page made only of frontmatter, as Markdown: JSON is valid YAML, so the data goes in as it is, with
 * no YAML library and no escaping to get wrong.
 */
export function frontmatterPage(frontmatter: Readonly<Record<string, unknown>>): string {
  return `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n`;
}
