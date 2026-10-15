import { ConfigError, configCatalog, configSettings, defineConfig, writeConfig } from '../index';
import { memorySource } from './helpers/memory-source';

const server = defineConfig('server', {
  mode: { env: 'APP_MODE', type: 'string', description: 'como roda', values: ['dev', 'prod'], default: 'dev' },
  port: { env: 'APP_PORT', path: ['server', 'port'], type: 'number', description: 'a porta', default: 3000 },
  verbose: { env: 'APP_VERBOSE', type: 'boolean', description: 'mostra tudo', default: false },
  tags: { env: 'APP_TAGS', type: 'list', description: 'rótulos' },
  token: { env: 'APP_TOKEN', type: 'string', description: 'a credencial', secret: true },
});

describe('defineConfig', () => {
  it('gives every key read, converted and checked, with the defaults', () => {
    const value = server.read([
      memorySource('ambiente', { APP_PORT: '8080', APP_VERBOSE: 'true', APP_TAGS: ' a, b ,,c' }),
    ]);
    const mode: 'dev' | 'prod' = value.mode;

    expect(mode).toBe('dev');
    expect(value).toEqual({ mode: 'dev', port: 8080, verbose: true, tags: ['a', 'b', 'c'], token: undefined });
    expect(server.token.name).toBe('config:server');
    expect(server.keys.map((key) => key.address)).toEqual([
      { env: 'APP_MODE', path: ['server', 'mode'] },
      { env: 'APP_PORT', path: ['server', 'port'] },
      { env: 'APP_VERBOSE', path: ['server', 'verbose'] },
      { env: 'APP_TAGS', path: ['server', 'tags'] },
      { env: 'APP_TOKEN', path: ['server', 'token'] },
    ]);
  });

  it('takes the first source that sets a key, and nested values as they are', () => {
    const value = server.read([
      memorySource(
        'arquivo',
        { 'server.port': 9000, 'server.mode': 'prod', 'server.tags': ['x', 1] },
        { layout: 'nested' },
      ),
      memorySource('outro', { APP_PORT: '1' }),
    ]);

    expect(value).toMatchObject({ mode: 'prod', port: 9000, tags: ['x', 1] });
  });

  it.each([
    [{ APP_PORT: '30a' }, 'APP_PORT: valor inválido ("30a"); esperava um número.'],
    [{ APP_PORT: 'Infinity' }, 'APP_PORT: valor inválido ("Infinity"); esperava um número.'],
    [{ APP_VERBOSE: 'yes' }, 'APP_VERBOSE: valor inválido ("yes"); esperava true ou false.'],
    [{ APP_MODE: 'test' }, 'APP_MODE: valor inválido ("test"); esperava um de: dev, prod.'],
  ])('refuses a flat value that does not convert (%j), naming the variable and the source', (values, message) => {
    expect(() => server.read([memorySource('.env', values)])).toThrow(`.env: ${message}`);
  });

  it('refuses a nested value of another type, and never shows a credential', () => {
    expect(() => server.read([memorySource('c.json', { 'server.port': '80' }, { layout: 'nested' })])).toThrow(
      'esperava um número',
    );
    expect(() => server.read([memorySource('c.json', { 'server.tags': 'a' }, { layout: 'nested' })])).toThrow(
      'esperava uma lista',
    );
    expect(() => server.read([memorySource('c.json', { 'server.token': 42 }, { layout: 'nested' })])).toThrow(
      'c.json: APP_TOKEN: valor inválido; esperava um texto.',
    );
    expect(() => server.read([memorySource('c.json', { 'server.verbose': 1 }, { layout: 'nested' })])).toThrow(
      'esperava true ou false',
    );
    expect(() =>
      server.read([memorySource('c.json', { 'server.port': Number.POSITIVE_INFINITY }, { layout: 'nested' })]),
    ).toThrow('esperava um número');
  });

  it('checks every item of a list against its allowed values', () => {
    const features = defineConfig('features', {
      enabled: {
        env: 'APP_FEATURES',
        type: 'list',
        description: 'recursos ativos',
        values: ['one', 'two'],
      },
    });

    expect(features.read([memorySource('.env', { APP_FEATURES: 'one, two' })])).toEqual({
      enabled: ['one', 'two'],
    });
    expect(() => features.read([memorySource('.env', { APP_FEATURES: 'one, three' })])).toThrow(
      'esperava um de: one, two',
    );
  });

  it('computes a default from the keys declared before it', () => {
    const paths = defineConfig('paths', {
      root: { env: 'APP_ROOT', type: 'string', description: 'a raiz' },
      data: {
        env: 'APP_DATA',
        type: 'string',
        description: 'os dados',
        default: (previous) => (previous['root'] === undefined ? undefined : `${String(previous['root'])}/data`),
      },
    });

    expect(paths.read([memorySource('ambiente', { APP_ROOT: '/w' })])).toEqual({ root: '/w', data: '/w/data' });
    expect(paths.read([])).toEqual({ root: undefined, data: undefined });
  });

  it('ignores symbol properties inspected on the previous keys', () => {
    const inspected = defineConfig('inspected', {
      first: { env: 'FIRST', type: 'string', description: 'primeira', default: 'one' },
      second: {
        env: 'SECOND',
        type: 'string',
        description: 'segunda',
        default: (previous) => {
          Reflect.get(previous, Symbol.toStringTag);
          return String(previous['first']);
        },
      },
    });

    expect(inspected.read([])).toEqual({ first: 'one', second: 'one' });
  });

  it('fails when a default reads a key declared after it, naming the group and the key', () => {
    const wrong = defineConfig('wrong', {
      first: { env: 'A', type: 'string', description: 'a', default: (previous) => String(previous['second']) },
      second: { env: 'B', type: 'string', description: 'b', default: 'b' },
    });

    expect(() => wrong.read([])).toThrow('wrong.first: o padrão usa second, que não vem antes no grupo.');
  });

  it('checks a fixed default when the group is declared', () => {
    expect(() =>
      defineConfig('bad', { mode: { env: 'X', type: 'string', description: 'x', values: ['a'], default: 'b' } }),
    ).toThrow('bad.mode (padrão): X: valor inválido ("b"); esperava um de: a.');
  });

  it("lets an error that is not the configuration's pass through", () => {
    const broken = defineConfig('broken', {
      key: {
        env: 'X',
        type: 'string',
        description: 'x',
        default: () => {
          throw new Error('bug');
        },
      },
    });

    expect(() => broken.read([])).toThrow('bug');
    expect(() => broken.read([])).not.toThrow(ConfigError);
  });
});

describe('configCatalog', () => {
  it('refuses one variable or one path in two groups, naming both', () => {
    const one = defineConfig('one', { a: { env: 'SAME', type: 'string', description: 'a' } });
    const two = defineConfig('two', { b: { env: 'SAME', type: 'string', description: 'b' } });
    const three = defineConfig('three', { a: { env: 'OTHER', path: ['one', 'a'], type: 'string', description: 'a' } });

    expect(() => configCatalog([one, two])).toThrow('A variável SAME está em one.a e em two.b.');
    expect(() => configCatalog([one, three])).toThrow('O caminho one.a está em one.a e em three.a.');
    expect(configCatalog([server]).keys).toHaveLength(5);
  });
});

describe('configSettings', () => {
  it('gives each key its value in effect and where it is from, never a credential', () => {
    const catalog = configCatalog([server]);
    const settings = configSettings(catalog, [
      memorySource('ambiente', { APP_PORT: '8080', APP_TOKEN: 'segredo', APP_VERBOSE: 'talvez' }),
      memorySource('.env', { APP_TAGS: 'a,b' }),
    ]);

    expect(settings.map(({ key, value, isSet, origin }) => [key.name, value, isSet, origin])).toEqual([
      ['mode', 'dev', true, 'padrão'],
      ['port', '8080', true, 'ambiente'],
      ['verbose', undefined, false, 'nenhum'],
      ['tags', 'a,b', true, '.env'],
      ['token', undefined, true, 'ambiente'],
    ]);
    expect(settings[2]?.error).toContain('APP_VERBOSE');
    expect(JSON.stringify(settings)).not.toContain('segredo');
  });

  it('gives a value the environment echoes from a later file to that file, and a different one to the environment', () => {
    const catalog = configCatalog([server]);
    const environment = memorySource('ambiente', { APP_PORT: '8080', APP_MODE: 'prod' }, { echoes: true });
    const file = memorySource('.env', { APP_PORT: '8080', APP_MODE: 'dev' });

    const origins = configSettings(catalog, [environment, file]).map(({ key, origin }) => [key.name, origin]);

    expect(origins.slice(0, 2)).toEqual([
      ['mode', 'ambiente'],
      ['port', '.env'],
    ]);
  });
});

describe('writeConfig', () => {
  it('writes into the first source that writes and says what is in effect after it', () => {
    const catalog = configCatalog([server]);
    const environment = memorySource('ambiente', { APP_MODE: 'dev' });
    const file = memorySource('.env', {}, { writable: true });

    const written = writeConfig(catalog, [environment, file], 'APP_PORT', '8080');
    const shadowed = writeConfig(catalog, [environment, file], 'APP_MODE', 'prod');

    expect(file.values).toEqual({ APP_PORT: 8080, APP_MODE: 'prod' });
    expect(written).toMatchObject({ source: '.env', setting: { value: '8080', origin: '.env' } });
    expect(shadowed).toMatchObject({ source: '.env', setting: { value: 'dev', origin: 'ambiente' } });
  });

  it('refuses an unknown key, a value that does not convert, and sources that do not write', () => {
    const catalog = configCatalog([server]);
    const readOnly = memorySource('ambiente', {});

    expect(() => writeConfig(catalog, [readOnly], 'NOPE', 'x')).toThrow(
      'Chave desconhecida: NOPE. As chaves são APP_MODE',
    );
    expect(() => writeConfig(catalog, [readOnly], 'APP_PORT', 'x')).toThrow('valor dado: APP_PORT');
    expect(() => writeConfig(catalog, [readOnly], 'APP_PORT', '1')).toThrow('Nenhuma fonte grava APP_PORT: ambiente.');
  });

  it('never shows a secret value when validating a write', () => {
    const credentials = defineConfig('credentials', {
      pin: { env: 'APP_PIN', type: 'number', description: 'o código', secret: true },
    });
    const catalog = configCatalog([credentials]);

    expect(() => writeConfig(catalog, [], 'APP_PIN', 'do-not-show')).toThrow('valor dado: APP_PIN: valor inválido');
    try {
      writeConfig(catalog, [], 'APP_PIN', 'do-not-show');
    } catch (error) {
      expect(String(error)).not.toContain('do-not-show');
    }
  });

  it('refuses a catalog whose key is no longer in its groups', () => {
    const catalog = configCatalog([server]);
    const inconsistent = { groups: [], keys: catalog.keys };
    const file = memorySource('.env', {}, { writable: true });

    expect(() => writeConfig(inconsistent, [file], 'APP_PORT', '8080')).toThrow('APP_PORT não está mais no catálogo.');
  });
});
