import { complete, formatHelp } from '@choliba/core/cli';

import { CHOLIBA_HELP, firstWordSpec, route } from '../route';

describe('route', () => {
  it('shows the help with no command, help, --help or -h', () => {
    for (const argv of [[], ['help'], ['--help'], ['-h', 'x']]) {
      expect(route(argv).kind).toBe('help');
    }
  });

  it('hands each subcommand the arguments after its name', () => {
    expect(route(['projects', 'list-projects'])).toEqual({ kind: 'projects', argv: ['list-projects'] });
    expect(route(['tests', 'red'])).toEqual({ kind: 'tests', argv: ['red'] });
    expect(route(['playwright-cli', 'open', 'x'])).toEqual({ kind: 'playwright-cli', argv: ['open', 'x'] });
    expect(route(['playwright-trace', 'open', 't.zip'])).toEqual({ kind: 'playwright-trace', argv: ['open', 't.zip'] });
    expect(route(['install', './agents/developer'])).toEqual({ kind: 'install', argv: ['./agents/developer'] });
    expect(route(['agents', 'list'])).toEqual({ kind: 'agents', argv: ['list'] });
  });

  it('routes completion, setup and the completion script to choliba itself', () => {
    expect(route(['__complete', 'pro'])).toEqual({ kind: '__complete', argv: ['pro'] });
    expect(route(['setup'])).toEqual({ kind: 'setup', argv: [] });
    expect(route(['completion', 'bash'])).toEqual({ kind: 'completion', argv: ['bash'] });
  });

  it('sends any other first word, an agent name, to the agents CLI whole', () => {
    expect(route(['product-owner', '--project', 'red'])).toEqual({
      kind: 'agents',
      argv: ['product-owner', '--project', 'red'],
    });
  });
});

describe('CHOLIBA_HELP', () => {
  it('lists the subcommands', () => {
    const help = formatHelp(CHOLIBA_HELP);

    expect(help).toContain('Usage:  choliba COMMAND [ARGS]');
    for (const name of ['agents', 'projects', 'tests', 'playwright-cli', 'playwright-trace', 'install']) {
      expect(help).toContain(`  ${name} `);
    }
  });
});

describe('firstWordSpec', () => {
  it('completes the first word with the subcommands and the agents of the workspace', () => {
    expect(complete(firstWordSpec(['product-owner', 'docs-updater']), ['p'])).toEqual({
      kind: 'values',
      values: ['projects', 'playwright-cli', 'playwright-trace', 'product-owner'],
    });
    expect(complete(firstWordSpec([]), ['se'])).toEqual({ kind: 'values', values: ['setup'] });
    expect(complete(firstWordSpec([]), ['in'])).toEqual({ kind: 'values', values: ['install'] });
    expect(complete(firstWordSpec([]), ['install', '--path', ''])).toEqual({ kind: 'files' });
  });

  it('completes what each subcommand takes after its name', () => {
    const spec = firstWordSpec([]);
    for (const name of ['install', 'lint', 'format', 'playwright-cli', 'playwright-trace']) {
      expect(complete(spec, [name, '..'])).toEqual({ kind: 'files' });
    }
    expect(complete(spec, ['install', '--'])).toEqual({ kind: 'values', values: ['--path', '--dry-run'] });
    expect(complete(spec, ['format', '--'])).toEqual({ kind: 'values', values: ['--write'] });
    // The projects and tickets come from the runner's own __complete, not from here.
    expect(complete(spec, ['tests', 'demo'])).toEqual({ kind: 'values', values: [] });
    expect(complete(spec, ['tests', 'demo:'])).toEqual({ kind: 'values', values: [] });
    expect(complete(spec, ['completion', ''])).toEqual({ kind: 'values', values: ['bash'] });
    expect(complete(spec, ['completion', 'bash', ''])).toEqual({ kind: 'values', values: [] });
  });
});
