import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import {
  besideModule,
  cholibaCacheDir,
  homeOf,
  xdgDir,
} from '../src/filesystem/index';

test('besideModule decodifica o caminho de uma pasta com espaço e acento', () => {
  const module =
    'file:///home/dev/%C3%81rea%20de%20Trabalho/app/src/approval/broker.ts';

  expect(besideModule(module, './hook-main.ts')).toBe(
    '/home/dev/Área de Trabalho/app/src/approval/hook-main.ts',
  );
  expect(besideModule(module, '../../package.json')).toBe(
    '/home/dev/Área de Trabalho/app/package.json',
  );
});

test('nenhum módulo acha um arquivo pelo pathname do import.meta.url', () => {
  const root = join(import.meta.dir, '..', 'src');
  const offenders = [...new Bun.Glob('**/*.{ts,tsx}').scanSync(root)]
    .filter((file) => !file.includes('node_modules') && !file.includes('dist/'))
    .filter((file) =>
      /import\.meta\.url\)\.pathname/.test(
        readFileSync(join(root, file), 'utf8'),
      ),
    );

  expect(offenders).toEqual([]);
});

test('cholibaCacheDir segue o HOME do ambiente que recebe', () => {
  expect(cholibaCacheDir({ HOME: '/home/dev' })).toBe(
    '/home/dev/.cache/choliba',
  );
  expect(cholibaCacheDir({ HOME: '/home/dev', XDG_CACHE_HOME: '' })).toBe(
    '/home/dev/.cache/choliba',
  );
  expect(
    cholibaCacheDir({ HOME: '/home/dev', XDG_CACHE_HOME: '/var/cache' }),
  ).toBe('/var/cache/choliba');
});

test('xdgDir usa a variável, ou o padrão sob o home quando ela falta ou está vazia', () => {
  const env = {
    HOME: '/home/dev',
    XDG_CONFIG_HOME: '/etc/dev',
    XDG_DATA_HOME: '',
  };

  expect(xdgDir(env, 'XDG_CONFIG_HOME')).toBe('/etc/dev');
  expect(xdgDir(env, 'XDG_DATA_HOME')).toBe('/home/dev/.local/share');
  expect(xdgDir(env, 'XDG_CACHE_HOME')).toBe('/home/dev/.cache');
});

test('homeOf usa o HOME do ambiente, ou o do sistema sem ele', () => {
  expect(homeOf({ HOME: '/home/dev' })).toBe('/home/dev');
  expect(homeOf({})).toBe(homedir());
});
