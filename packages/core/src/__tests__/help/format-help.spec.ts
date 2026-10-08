import type { CommandSpec } from '../../help/interfaces/help.interface';
import { formatHelp, formatRows, HELP_WIDTH } from '../../help/format-help';

describe('formatHelp', () => {
  it('lays out usage, description, command groups, options and footer like docker --help', () => {
    const spec: CommandSpec = {
      usage: 'tool [OPTIONS] COMMAND',
      description: 'Does things.',
      commands: () => [
        { name: 'deploy', description: 'Deploy an app', group: 'Common Commands', spec: { usage: 'x' } },
        { name: 'ls', description: 'List apps', group: 'Other', spec: { usage: 'x' } },
        { name: 'rm', description: 'Remove an app', group: 'Common Commands', spec: { usage: 'x' } },
      ],
      flags: [
        { name: '--env', description: 'Environment', value: { name: 'string' } },
        { name: '--help', aliases: ['-h'], description: 'Show help' },
        { name: '--quiet', description: '' },
      ],
      footer: "Run 'tool COMMAND --help' for more information on a command.",
    };

    expect(formatHelp(spec)).toBe(
      [
        'Usage:  tool [OPTIONS] COMMAND',
        '',
        'Does things.',
        '',
        'Common Commands:',
        '  deploy   Deploy an app',
        '  rm       Remove an app',
        '',
        'Other:',
        '  ls       List apps',
        '',
        'Options:',
        '      --env string   Environment',
        '  -h, --help         Show help',
        '      --quiet',
        '',
        "Run 'tool COMMAND --help' for more information on a command.",
      ].join('\n'),
    );
  });

  it('wraps a wide indented line (an example) under its indentation, continuations two columns further', () => {
    const example = `  choliba-cli new pasta ${'--opcao valor '.repeat(6).trim()}`;
    const help = formatHelp({ usage: 'x', description: `Exemplos:\n${example}\n  curto` });
    const lines = help.split('\n').slice(help.split('\n').indexOf('Exemplos:') + 1);
    expect(lines[0]).toMatch(/^ {2}choliba-cli new pasta --opcao/);
    expect(lines[1]).toMatch(/^ {4}--opcao|^ {4}valor/);
    expect(lines.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim()).toBe(example.trim());
    expect(lines[2]).toBe('  curto');
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(HELP_WIDTH);
  });

  it('wraps descriptions at 80 columns, aligning continuation lines under the text', () => {
    const long = 'word '.repeat(30).trim();
    const text = formatHelp({
      usage: 'tool',
      description: `${long}\n  kept line`,
      commands: () => [{ name: 'run', description: long, group: 'Commands', spec: { usage: 'x' } }],
      flags: [{ name: '--flag', description: long }],
      footer: long,
    });

    for (const line of text.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(HELP_WIDTH);
    }
    expect(text).toContain('\n  kept line\n');
    expect(text).toContain('Commands:\n  run   word word');
    expect(text).toMatch(/\n {8}word word/);
    expect(text).toMatch(/\n {15}word word/);
  });

  it('separates the entries of a group with a blank line when some description wraps', () => {
    const long = 'word '.repeat(30).trim();
    const text = formatHelp({
      usage: 'tool',
      commands: () => [
        { name: 'run', description: long, group: 'Wrapped', spec: { usage: 'x' } },
        { name: 'ls', description: 'List', group: 'Wrapped', spec: { usage: 'x' } },
        { name: 'rm', description: 'Remove', group: 'Compact', spec: { usage: 'x' } },
        { name: 'up', description: 'Start', group: 'Compact', spec: { usage: 'x' } },
      ],
    });

    expect(text).toMatch(/\n {8}word word\n\n {2}ls {4}List\n/);
    expect(text).toContain('Compact:\n  rm    Remove\n  up    Start');
  });

  it('spaces the options the same way when some description wraps', () => {
    const long = 'word '.repeat(30).trim();
    const wrapped = formatHelp({
      usage: 'tool',
      flags: [
        { name: '--long', description: long },
        { name: '--short', description: 'Short' },
      ],
    });
    const compact = formatHelp({
      usage: 'tool',
      flags: [
        { name: '--a', description: 'A' },
        { name: '--b', description: 'B' },
      ],
    });

    expect(wrapped).toMatch(/word word\n\n {6}--short {3}Short$/);
    expect(compact).toContain('Options:\n      --a   A\n      --b   B');
  });

  it("lists a flag's values under its description, indented to that column", () => {
    const long = 'word '.repeat(20).trim();
    const text = formatHelp({
      usage: 'tool',
      flags: [
        {
          name: '--kind',
          value: { name: 'kind' },
          description: 'Kind:',
          choices: [
            { name: 'a', description: 'First' },
            { name: 'bbb', description: long },
          ],
        },
        { name: '--x', description: 'X' },
      ],
    });

    expect(text).toContain(
      [
        '      --kind kind   Kind:',
        '',
        '                    a     First',
        '',
        '                    bbb   word word',
      ].join('\n'),
    );
    expect(text).toMatch(/\n {26}word word/);
    expect(text).toMatch(/word\n\n {6}--x {11}X$/);
    for (const line of text.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(HELP_WIDTH);
    }
  });

  it('lays out rows outside a --help the same way', () => {
    expect(
      formatRows([
        ['a', 'First'],
        ['bbb', 'Second'],
      ]),
    ).toBe('a     First\nbbb   Second');
    expect(
      formatRows([
        ['a', ''],
        ['b', 'x'],
      ]),
    ).toBe('a\nb   x');
  });

  it('keeps a word longer than the line whole', () => {
    expect(formatHelp({ usage: 'tool', description: 'x'.repeat(90) })).toBe(`Usage:  tool\n\n${'x'.repeat(90)}`);
  });

  it('prints only the usage when nothing else is declared', () => {
    expect(formatHelp({ usage: 'tool' })).toBe('Usage:  tool');
    expect(formatHelp({ usage: 'tool', commands: () => [], flags: [] })).toBe('Usage:  tool');
  });
});
