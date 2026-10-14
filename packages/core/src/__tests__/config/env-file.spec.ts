import { configValueError, findConfigKey, parseConfigFile, withEnvValue } from '../../config/index';

const ENV = ['# Onde roda o provider.', '# CHOL_SANDBOX=local', 'CHOL_GLOBAL_DIR=/w/global', '', '# fim', ''].join(
  '\n',
);

describe('withEnvValue', () => {
  it('sets the value where the key is set, leaving the rest as it was', () => {
    expect(withEnvValue(ENV, 'CHOL_GLOBAL_DIR', '/outro')).toBe(
      ENV.replace('CHOL_GLOBAL_DIR=/w/global', 'CHOL_GLOBAL_DIR=/outro'),
    );
  });

  it("turns the template's commented line into the setting, under its explanation", () => {
    const written = withEnvValue(ENV, 'CHOL_SANDBOX', 'docker');

    expect(written.split('\n').slice(0, 2)).toEqual(['# Onde roda o provider.', 'CHOL_SANDBOX=docker']);
    expect(written.split('\n').length).toBe(ENV.split('\n').length);
  });

  it('adds a key no line names at the end, with or without a final newline', () => {
    expect(withEnvValue(ENV, 'CHOL_NETWORK', 'host').endsWith('# fim\nCHOL_NETWORK=host\n')).toBe(true);
    expect(withEnvValue('A=1', 'CHOL_NETWORK', 'host')).toBe('A=1\nCHOL_NETWORK=host\n');
    expect(withEnvValue('', 'CHOL_NETWORK', 'host')).toBe('CHOL_NETWORK=host\n');
  });

  it('quotes a value with a space, a # or a quote, and reads back the same value', () => {
    for (const value of ['agents.po=red, x', 'a#b', 'say "oi"', "it's"]) {
      expect(parseConfigFile(withEnvValue('', 'CHOL_COLORS', value))['CHOL_COLORS']).toBe(value);
    }
    expect(withEnvValue('', 'CHOL_COLORS', 'say "oi"')).toBe(`CHOL_COLORS='say "oi"'\n`);
    expect(withEnvValue('', 'CHOL_SANDBOX', 'docker')).toBe('CHOL_SANDBOX=docker\n');
  });
});

describe('configValueError', () => {
  it('takes a known key with a value of its list, or any value when it has none', () => {
    expect(configValueError('CHOL_SANDBOX', 'docker')).toBeUndefined();
    expect(configValueError('CHOL_COLORS', 'agents.po=red')).toBeUndefined();
    expect(findConfigKey('CHOL_SANDBOX')?.values).toEqual(['local', 'docker']);
  });

  it('refuses a key it does not know, and a value out of the list, saying what to use', () => {
    expect(configValueError('CHOL_SANDBOXX', 'docker')).toMatch(
      /^Chave desconhecida: CHOL_SANDBOXX\. As chaves são CHOL_GLOBAL_DIR, /,
    );
    expect(configValueError('CHOL_SANDBOX', 'vm')).toBe('Valor inválido para CHOL_SANDBOX: vm. Use local, docker.');
    expect(configValueError('CHOL_COLORS', 'a\nb')).toMatch(/quebra de linha/);
    expect(configValueError('CHOL_COLORS', `"a" 'b'`)).toMatch(/dois tipos de aspas/);
  });
});
