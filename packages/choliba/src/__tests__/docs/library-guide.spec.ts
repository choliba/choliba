import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..', '..', '..');
const GUIDE = readFileSync(join(repo, 'docs', 'guias', 'usar-biblioteca.md'), 'utf8');

/** The TypeScript blocks of the guide, in order. */
function tsBlocks(markdown: string): readonly string[] {
  return [...markdown.matchAll(/^```ts\n([\s\S]*?)^```$/gm)].map((match) => match[1] ?? '');
}

/** Where `choliba` and its subpaths come from in this repository, as the published package maps them. */
const PATHS = {
  choliba: [join(repo, 'packages', 'choliba', 'src', 'index.ts')],
  'choliba/agents': [join(repo, 'packages', 'agents', 'src', 'index.ts')],
  'choliba/config': [join(repo, 'packages', 'config', 'src', 'index.ts')],
  'choliba/projects': [join(repo, 'packages', 'projects', 'src', 'index.ts')],
  'choliba/sandbox': [join(repo, 'packages', 'sandbox', 'src', 'index.ts')],
};

describe('docs/guias/usar-biblioteca.md', () => {
  const blocks = tsBlocks(GUIDE);

  it('has every example importing what it uses from choliba, so each one reads on its own', () => {
    expect(blocks.length).toBeGreaterThan(5);
    expect(blocks.filter((block) => !block.startsWith('import '))).toEqual([]);
  });

  it("compiles every example against the library's own types", () => {
    const dir = mkdtempSync(join(tmpdir(), 'library-guide-'));
    try {
      const files = blocks.map((block, index) => {
        const file = `exemplo-${String(index + 1).padStart(2, '0')}.ts`;
        // Each example is a module of its own: its names never clash with another's.
        writeFileSync(join(dir, file), `${block}\nexport {};\n`);
        return file;
      });
      writeFileSync(
        join(dir, 'tsconfig.json'),
        JSON.stringify({
          extends: join(repo, 'tsconfig.base.json'),
          compilerOptions: {
            noEmit: true,
            paths: PATHS,
            types: ['node'],
            typeRoots: [join(repo, 'node_modules', '@types')],
          },
          files,
        }),
      );
      const tsc = join(repo, 'node_modules', 'typescript', 'bin', 'tsc');
      let output = '';
      try {
        execFileSync('node', [tsc, '-p', join(dir, 'tsconfig.json'), '--pretty', 'false'], { encoding: 'utf8' });
      } catch (error) {
        output = (error as { stdout?: string }).stdout ?? String(error);
      }
      expect(output).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
