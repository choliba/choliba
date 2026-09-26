import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pathGlob, readAgentPermissions } from '../permissions';

describe('readAgentPermissions', () => {
  it('reads every group of the allowlist and the denylist', () => {
    const instructions = [
      '<agent><permissions>',
      '<allowlist>',
      '<allow action="read"><tool>Read</tool><path>src/</path></allow>',
      '<allow action="write"><path description="docs">docs/</path></allow>',
      '<allow action="all"><path>tmp/</path></allow>',
      '<allow action="run"><command>git diff</command><command>echo a &amp;&amp; b &lt;x&gt; &quot;q&quot; &apos;s&apos;</command></allow>',
      '</allowlist>',
      '<denylist>',
      '<deny action="read"><path>.env</path></deny>',
      '<deny action="write"><path>packages/</path></deny>',
      '<deny action="run"><command>  prettier  </command></deny>',
      '</denylist>',
      '</permissions></agent>',
    ].join('\n');

    expect(readAgentPermissions(instructions)).toEqual({
      allowTools: ['Read'],
      allowRead: ['src/', 'tmp/'],
      allowWrite: ['docs/', 'tmp/'],
      allowRun: ['git diff', 'echo a && b <x> "q" \'s\''],
      denyRead: ['.env'],
      denyWrite: ['packages/'],
      denyRun: ['prettier'],
    });
  });

  it('gives empty lists when there is no permissions section', () => {
    expect(readAgentPermissions('<agent><system_role>x</system_role></agent>')).toEqual({
      allowTools: [],
      allowRead: [],
      allowWrite: [],
      allowRun: [],
      denyRead: [],
      denyWrite: [],
      denyRun: [],
    });
  });

  it("reads the docs-updater's real declarations", () => {
    const repoRoot = join(__dirname, '..', '..', '..', '..');
    const permissions = readAgentPermissions(readFileSync(join(repoRoot, 'agents/docs-updater/system.md'), 'utf8'));

    expect(permissions.allowWrite).toEqual(['docs/', 'README.md']);
    expect(permissions.denyRun).toContain('prettier');
  });
});

describe('pathGlob', () => {
  it('turns a directory into everything under it and keeps anything else', () => {
    expect(pathGlob('docs/')).toBe('docs/**');
    expect(pathGlob('README.md')).toBe('README.md');
    expect(pathGlob('tsconfig*.json')).toBe('tsconfig*.json');
  });
});
