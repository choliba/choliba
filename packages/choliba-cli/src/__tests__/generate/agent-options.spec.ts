import { isValidAgentName } from '@choliba/agents';

import { agentName, parseAgentNewOptions } from '../../generate/agent-options';
import { UsageError } from '../../common/errors';

describe('parseAgentNewOptions', () => {
  it('reads the name and every flag, with or without =', () => {
    expect(
      parseAgentNewOptions([
        'revisor',
        '--description',
        'Revisa',
        '--role=Você revisa.',
        '--models',
        'a, b,,',
        '--project',
        '--access=escrita',
        '--no-input',
      ]),
    ).toEqual({
      name: 'revisor',
      description: 'Revisa',
      role: 'Você revisa.',
      models: ['a', 'b'],
      project: true,
      access: 'escrita',
      noInput: true,
    });
    expect(parseAgentNewOptions([])).toEqual({ noInput: false });
    expect(parseAgentNewOptions(['--no-project', '--access', 'nada'])).toEqual({
      project: false,
      access: 'nada',
      noInput: false,
    });
  });

  it('refuses what it cannot run', () => {
    const refused: readonly (readonly string[])[] = [
      ['--quem'],
      ['a', 'b'],
      ['--role'],
      ['--role', '--project'],
      ['--access', 'tudo'],
      ['--no-project', '--access', 'leitura'],
      ['Revisor'],
    ];
    for (const argv of refused) expect(() => parseAgentNewOptions(argv)).toThrow(UsageError);
    expect(() => parseAgentNewOptions(['--no-project', '--access', 'testes'])).toThrow(
      '--access testes precisa de um projeto: tire --no-project.',
    );
  });
});

describe('agentName', () => {
  it('takes only the names the choliba takes for an agent', () => {
    for (const name of ['revisor', 'test-writer', 'a_1', '9x']) {
      expect(agentName(name)).toBe(name);
      expect(isValidAgentName(name)).toBe(true);
    }
    for (const name of ['Revisor', '-x', 'a b', '']) {
      expect(() => agentName(name)).toThrow('não serve de nome de agente');
      expect(isValidAgentName(name)).toBe(false);
    }
  });
});
