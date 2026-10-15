import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..');

/** Every source file of the package, without its specs. */
function sources(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('the boundary of @choliba/config', () => {
  it('knows nothing of the program that uses it', () => {
    const coupled = sources(SRC)
      .filter((file) => /@choliba\/|CHOL_|choliba/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));

    expect(coupled).toEqual([]);
  });
});
