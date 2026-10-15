import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { envSource, fileSource, json } from '../index';
import { makeTmpDir } from './helpers/tmp';

const PORT = { env: 'APP_PORT', path: ['server', 'port'] };

describe('envSource', () => {
  it('reads by the variable name, echoes later sources and does not write', () => {
    const source = envSource({ APP_PORT: '3000' });

    expect(source.read(PORT)).toBe('3000');
    expect(source.read({ env: 'NONE', path: [] })).toBeUndefined();
    expect(source).toMatchObject({ name: 'ambiente', layout: 'flat', echoesLaterSources: true });
    expect('write' in source).toBe(false);
    expect(envSource({}, 'shell').name).toBe('shell');
  });
});

describe('fileSource', () => {
  it('defaults to a .env source', () => {
    expect(fileSource()).toMatchObject({ name: '.env', layout: 'flat' });
  });

  it('reads a .env by name and a nested file by path, named after the file', () => {
    const tmp = makeTmpDir('config-source');
    try {
      writeFileSync(join(tmp.path, '.env'), 'APP_PORT=3000\n');
      writeFileSync(join(tmp.path, 'app.json'), '{"server":{"port":8080,"name":"x"}}');
      const dotenv = fileSource(join(tmp.path, '.env'));
      const nested = fileSource(join(tmp.path, 'app.json'));

      expect(dotenv.read(PORT)).toBe('3000');
      expect(nested.read(PORT)).toBe(8080);
      expect(nested.read({ env: 'X', path: ['server', 'name', 'deeper'] })).toBeUndefined();
      expect(nested.read({ env: 'X', path: ['client'] })).toBeUndefined();
      expect([dotenv.name, nested.name, nested.layout]).toEqual(['.env', 'app.json', 'nested']);
      expect('write' in nested).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('is empty when the file does not exist, and writes it then', () => {
    const tmp = makeTmpDir('config-source');
    try {
      const file = join(tmp.path, '.env');
      const source = fileSource(file);

      expect(source.read(PORT)).toBeUndefined();
      source.write?.(PORT, 3000);

      expect(readFileSync(file, 'utf8')).toBe('APP_PORT=3000\n');
      expect(source.read(PORT)).toBe('3000');
    } finally {
      tmp.cleanup();
    }
  });

  it.each(['missing.json', 'missing.yaml'])('is empty when a nested %s file does not exist', (name) => {
    const tmp = makeTmpDir('config-source');
    try {
      expect(fileSource(join(tmp.path, name)).read(PORT)).toBeUndefined();
    } finally {
      tmp.cleanup();
    }
  });

  it('takes the format and the name it is given', () => {
    const tmp = makeTmpDir('config-source');
    try {
      const file = join(tmp.path, 'settings');
      writeFileSync(file, '{"server":{"port":1}}');

      const source = fileSource(file, { format: json, name: 'configurações' });

      expect(source.read(PORT)).toBe(1);
      expect(source.name).toBe('configurações');
    } finally {
      tmp.cleanup();
    }
  });
});
