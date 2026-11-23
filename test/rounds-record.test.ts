import { afterEach, expect, test } from 'bun:test';

import { sanitize } from '../src/rounds/record';

const NAME = 'ROUNDS_TEST_API_TOKEN';

afterEach(() => {
  Reflect.deleteProperty(process.env, NAME);
});

test('sanitize: o valor de uma credencial do ambiente vira o nome dela', () => {
  process.env[NAME] = 'valor-bem-secreto-123';

  expect(sanitize('chave valor-bem-secreto-123 no log', '/x/app')).toBe(
    `chave <${NAME}> no log`,
  );
});

test('sanitize: um valor curto demais, ou de uma variável que não é credencial, fica', () => {
  process.env[NAME] = 'curto';
  process.env['ROUNDS_TEST_NOME'] = 'um-valor-comprido-aqui';
  try {
    expect(sanitize('curto e um-valor-comprido-aqui', '/x/app')).toBe(
      'curto e um-valor-comprido-aqui',
    );
  } finally {
    Reflect.deleteProperty(process.env, 'ROUNDS_TEST_NOME');
  }
});

test('sanitize: o caminho do projeto vira <projeto>', () => {
  expect(sanitize('lê /x/app/src/a.ts', '/x/app')).toBe(
    'lê <projeto>/src/a.ts',
  );
});
