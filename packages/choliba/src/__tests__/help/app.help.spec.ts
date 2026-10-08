import { complete, formatHelp } from '@choliba/core';

import { CHOLIBA_HELP, COMMANDS, commandHelp } from '../../help/app.help';

describe('CHOLIBA_HELP', () => {
  it('lists the commands and the flags every command takes', () => {
    const help = formatHelp(CHOLIBA_HELP);

    expect(help).toContain('Usage:  choliba COMMAND [ARGS]');
    for (const name of ['agents', 'projects', 'tests', 'install']) {
      expect(help).toContain(`  ${name} `);
    }
    // The agents' playwright tools are run tools, written for each run, not commands of choliba.
    expect(help).not.toContain('playwright-');
    expect(help).toContain('--no-color');
  });
});

describe('commandHelp', () => {
  it('describes a command choliba runs itself, by the line --help lists it with', () => {
    const install = commandHelp('install');
    expect(install.usage).toBe('choliba install <origem> [OPTIONS]');
    expect(formatHelp(install)).toContain('Instala um agente');
    expect(formatHelp(install)).toContain('--dry-run');
    for (const name of ['check', 'setup', 'completion']) {
      expect(commandHelp(name).usage).toContain(`choliba ${name}`);
    }
  });

  it('is the help of choliba itself for a name it does not list', () => {
    expect(commandHelp('nope')).toBe(CHOLIBA_HELP);
  });
});

describe('COMMANDS', () => {
  const spec = { ...CHOLIBA_HELP, commands: () => COMMANDS };

  it('completes what each command takes after its name', () => {
    for (const name of ['install', 'lint', 'format']) {
      expect(complete(spec, [name, '..'])).toEqual({ kind: 'files' });
    }
    expect(complete(spec, ['install', '--'])).toEqual({ kind: 'values', values: ['--path', '--dry-run'] });
    expect(complete(spec, ['install', '--path', ''])).toEqual({ kind: 'files' });
    expect(complete(spec, ['format', '--'])).toEqual({ kind: 'values', values: ['--write'] });
    expect(complete(spec, ['completion', ''])).toEqual({ kind: 'values', values: ['bash'] });
    expect(complete(spec, ['completion', 'bash', ''])).toEqual({ kind: 'values', values: [] });
    // Without a workspace there are no projects, nor tickets after `project:`.
    expect(complete(spec, ['tests', 'd'])).toEqual({ kind: 'values', values: [] });
    expect(complete(spec, ['tests', 'demo:'])).toEqual({ kind: 'values', values: [] });
  });
});
