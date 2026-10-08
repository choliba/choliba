import { AGENTS_SOURCE, CHOLIBA_PACKAGE, parseNewOptions } from '../../new/new-options';
import { UsageError } from '../../common/errors';

describe('parseNewOptions', () => {
  it('reads new with its folder and options, in both --flag value and --flag=value', () => {
    expect(
      parseNewOptions([
        'pasta',
        '--provider',
        'claude',
        '--agents=product-owner, implementer',
        '--mcp-app-dir',
        '/mcp',
        '--choliba=./c.tgz',
        '--agents-from',
        '/repo',
        '--no-input',
      ]),
    ).toEqual({
      dir: 'pasta',
      provider: 'claude',
      agents: ['product-owner', 'implementer'],
      mcpAppDir: '/mcp',
      choliba: './c.tgz',
      agentsFrom: '/repo',
      noInput: true,
    });
    expect(parseNewOptions(['--no-agents'])).toEqual({
      agents: [],
      choliba: CHOLIBA_PACKAGE,
      agentsFrom: AGENTS_SOURCE,
      noInput: false,
    });
  });

  it.each([
    [['--provider', 'x'], '--provider aceita auto, claude, cursor (veio "x").'],
    [
      ['new', '--agents', 'docs-updater'],
      '--agents aceita product-owner, test-writer, implementer (veio "docs-updater").',
    ],
    [['--provider'], '--provider precisa de um valor.'],
    [['--choliba', '--no-input'], '--choliba precisa de um valor.'],
    [['--force'], 'opção desconhecida: --force.'],
    [['a', 'b'], 'só uma pasta por vez (veio também "b").'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseNewOptions(argv)).toThrow(UsageError);
    expect(() => parseNewOptions(argv)).toThrow(message);
  });
});
