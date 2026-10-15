import { ConfigError, configTree, dotenv, formatFor, json, yaml } from '../index';

const SANDBOX = { env: 'APP_SANDBOX', path: ['sandbox', 'mode'] };

describe('dotenv', () => {
  it('reads KEY=value lines, without quotes, comments or blank lines', () => {
    const text = ['# a porta', 'PORT=3000', '', 'NAME="Ana Maria"', "OTHER='x'", 'no-equals', ' SPACED = y '].join(
      '\n',
    );

    expect(dotenv.parse(text, '.env')).toEqual({ PORT: '3000', NAME: 'Ana Maria', OTHER: 'x', SPACED: 'y' });
  });

  it('writes a key in place, over its commented line, or at the end, keeping the rest', () => {
    const write = dotenv.write;
    if (write === undefined) throw new Error('dotenv grava');

    expect(write('A=1\nAPP_SANDBOX=local\n', SANDBOX, 'docker')).toBe('A=1\nAPP_SANDBOX=docker\n');
    expect(write('# onde roda\n# APP_SANDBOX=local\n', SANDBOX, 'docker')).toBe('# onde roda\nAPP_SANDBOX=docker\n');
    expect(write('A=1', SANDBOX, 'docker')).toBe('A=1\nAPP_SANDBOX=docker\n');
    expect(write('', SANDBOX, 'docker')).toBe('APP_SANDBOX=docker\n');
  });

  it('quotes a value that needs it with the quote it lacks, and joins a list by commas', () => {
    const write = dotenv.write;
    if (write === undefined) throw new Error('dotenv grava');

    expect(write('', SANDBOX, 'Ana Maria')).toBe('APP_SANDBOX="Ana Maria"\n');
    expect(write('', SANDBOX, 'diz "oi"')).toBe(`APP_SANDBOX='diz "oi"'\n`);
    expect(write('', SANDBOX, ['a', 1, true])).toBe('APP_SANDBOX=a,1,true\n');
    expect(write('', SANDBOX, 3000)).toBe('APP_SANDBOX=3000\n');
  });

  it('refuses what one line cannot keep', () => {
    const write = dotenv.write;
    if (write === undefined) throw new Error('dotenv grava');

    expect(() => write('', SANDBOX, 'a\nb')).toThrow(ConfigError);
    expect(() => write('', SANDBOX, `"'`)).toThrow('os dois tipos de aspas');
    expect(() => write('', SANDBOX, ['a,b'])).toThrow('não pode ter vírgula');
  });
});

describe('json and yaml', () => {
  it('read a tree, leaving out keys with no value', () => {
    expect(
      json.parse('{"sandbox":{"mode":"docker","port":3000,"on":true,"tags":["a",1]},"gone":null}', 'c.json'),
    ).toEqual({
      sandbox: { mode: 'docker', port: 3000, on: true, tags: ['a', 1] },
    });
    expect(yaml.parse('sandbox:\n  mode: docker\n  empty:\n', 'c.yaml')).toEqual({ sandbox: { mode: 'docker' } });
    expect(yaml.parse('', 'c.yaml')).toEqual({});
  });

  it('name the file when it does not parse', () => {
    expect(() => json.parse('{', 'c.json')).toThrow('c.json não é um JSON válido');
    expect(() => yaml.parse('a: [', 'c.yaml')).toThrow('c.yaml não é um YAML válido');
  });
});

describe('configTree', () => {
  it('refuses a list inside a list, an object inside a list, a file that is not an object and other values', () => {
    expect(() => configTree({ a: [[1]] }, 'c.json')).toThrow('c.json.a: uma lista só pode ter');
    expect(() => configTree({ a: { b: [{ c: 1 }] } }, 'c.json')).toThrow('c.json.a.b: uma lista');
    expect(() => configTree([1], 'c.json')).toThrow('c.json: o arquivo tem que ser um objeto');
    expect(() => configTree({ a: Number.NaN }, 'c.json')).toThrow('c.json.a: valor que a configuração não lê');
    expect(configTree(null, 'c.json')).toEqual({});
  });
});

describe('formatFor', () => {
  it('knows a format by the file name', () => {
    expect(formatFor('/w/.env')).toBe(dotenv);
    expect(formatFor('.env.local')).toBe(dotenv);
    expect(formatFor('config.json')).toBe(json);
    expect(formatFor('a/b.yml')).toBe(yaml);
    expect(formatFor('b.yaml')).toBe(yaml);
  });

  it('says which formats it knows for any other name', () => {
    expect(() => formatFor('config.toml')).toThrow('config.toml: formato desconhecido. Use um arquivo .env, .json');
  });
});
