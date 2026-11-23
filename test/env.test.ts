import { afterEach, expect, test } from 'bun:test';

import { env } from '../src/config/index';
import { UsageError } from '../src/errors';

const NAME = 'CHOLIBA_TEST_ENV_VALUE';

afterEach(() => {
  Reflect.deleteProperty(process.env, NAME);
});

function set(value: string): void {
  process.env[NAME] = value;
}

test('ausente ou vazia: undefined, o default, ou um UsageError quando obrigatória', () => {
  expect(env.string(NAME)).toBeUndefined();
  set('   ');
  expect(env.string(NAME)).toBeUndefined();
  expect(env.string(NAME, { default: 'padrão' })).toBe('padrão');
  expect(() => env.string(NAME, { required: true })).toThrow(UsageError);
  expect(() => env.number(NAME, { required: true })).toThrow(NAME);
  expect(env.list(NAME)).toBeUndefined();
  expect(env.boolean(NAME, { default: true })).toBe(true);
});

test('string devolve o texto como veio', () => {
  set('~/dev/rodadas');
  expect(env.string(NAME, { required: true })).toBe('~/dev/rodadas');
});

test('number converte, e recusa o que não é número', () => {
  set('42');
  expect(env.number(NAME)).toBe(42);
  set('quarenta');
  expect(() => env.number(NAME)).toThrow('deve ser um número; veio "quarenta"');
});

test('boolean aceita sim e não nas grafias comuns, e recusa o resto', () => {
  for (const word of ['1', 'true', 'TRUE', 'yes', 'on']) {
    set(word);
    expect(env.boolean(NAME)).toBe(true);
  }
  for (const word of ['0', 'false', 'no', 'Off']) {
    set(word);
    expect(env.boolean(NAME)).toBe(false);
  }
  set('talvez');
  expect(() => env.boolean(NAME)).toThrow(UsageError);
});

test('list separa por vírgulas e descarta itens vazios', () => {
  set(' a, b ,,c ');
  expect(env.list(NAME)).toEqual(['a', 'b', 'c']);
});
