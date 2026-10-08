import { writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Prompter } from '../../runtime/prompter';
import type { CliRuntime } from '../../runtime/interfaces/runtime.interface';

/** What the fake runtime ran, as `<folder>$ <command line>`. */
export interface FakeRuntime extends CliRuntime {
  readonly calls: string[];
}

/** A runtime whose `bun add` writes the `.env` the choliba setup would, and whose `choliba check` exits `checkCode`. */
export function fakeRuntime(overrides: Partial<CliRuntime> = {}, checkCode = 0): FakeRuntime {
  const calls: string[] = [];
  const asking: Prompter = {
    text: () => Promise.resolve('perguntada'),
    select: (_q, _c, fallback) => Promise.resolve(fallback),
    multiselect: () => Promise.resolve([]),
  };
  return {
    calls,
    prompter: asking,
    interactive: false,
    packageDir: '/nowhere',
    run: (command, args, cwd) => {
      const line = [command, ...args].join(' ');
      calls.push(`${path.basename(cwd)}$ ${line}`);
      if (line.startsWith('bun add')) writeFileSync(path.join(cwd, '.env'), '# CHOL_AGENTS_PROVIDER=auto\n');
      return line.endsWith('choliba check') ? checkCode : 0;
    },
    ...overrides,
  };
}
