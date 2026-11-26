import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { besideModule } from '../src/filesystem/index';

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
