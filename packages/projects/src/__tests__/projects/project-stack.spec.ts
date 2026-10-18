import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseProjectStack, PROJECT_CONFIG_KEYS, ProjectsError, writeProjectConfigKey } from '../../index';

const STACK = {
  language: { name: 'TypeScript', version: '^5.9', url: 'https://www.typescriptlang.org/' },
  frameworks: [{ name: 'react', version: '^19.0', url: 'https://react.dev/' }],
  libraries: [{ name: 'tailwindcss', version: '^4.1', url: '' }],
  tools: [{ name: 'Docker', version: '', url: '' }],
};

/** A projects folder with `demo/config.json` holding `config`, removed after `fn`. */
function withConfig(config: string, fn: (projectsDir: string, file: string) => void): void {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-stack-'));
  const file = path.join(projectsDir, 'demo', 'config.json');
  try {
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, config);
    fn(projectsDir, file);
  } finally {
    fs.rmSync(projectsDir, { recursive: true, force: true });
  }
}

describe('parseProjectStack', () => {
  it('takes a language and three lists of items, each list optional, version and url empty when absent', () => {
    expect(parseProjectStack(STACK, 'config.stack')).toEqual(STACK);
    expect(parseProjectStack({ language: { name: 'PHP' } }, 'config.stack')).toEqual({
      language: { name: 'PHP', version: '', url: '' },
      frameworks: [],
      libraries: [],
      tools: [],
    });
  });

  it('trims the texts of an item', () => {
    const stack = {
      language: { name: 'PHP' },
      libraries: [{ name: ' aura/sqlquery ', version: ' ^2.8', url: ' https://a' }],
    };

    expect(parseProjectStack(stack, 'config.stack').libraries).toEqual([
      { name: 'aura/sqlquery', version: '^2.8', url: 'https://a' },
    ]);
  });

  it('says what is wrong, naming the field', () => {
    const fails = (value: unknown, message: string): void => {
      expect(() => parseProjectStack(value, 'config.stack')).toThrow(ProjectsError);
      expect(() => parseProjectStack(value, 'config.stack')).toThrow(message);
    };
    const php = { name: 'PHP' };

    fails(['TypeScript'], 'config.stack precisa ser um objeto.');
    fails({ frameworks: [] }, 'config.stack.language é obrigatório.');
    fails({ language: 'PHP' }, 'config.stack.language precisa ser um objeto { name, version, url }.');
    fails({ language: { name: ' ' } }, 'config.stack.language.name é obrigatório (texto não vazio).');
    fails({ language: { name: 'PHP', version: 8 } }, 'config.stack.language.version precisa ser um texto.');
    fails(
      { language: { name: 'PHP', link: 'x' } },
      'config.stack.language.link não existe (esperado: name, version, url).',
    );
    fails({ language: php, tools: 'Docker' }, 'config.stack.tools precisa ser uma lista.');
    fails(
      { language: php, libraries: [php, 'Yii'] },
      'config.stack.libraries[1] precisa ser um objeto { name, version, url }.',
    );
    fails(
      { language: php, versions: [] },
      'config.stack.versions não existe (esperado: language, frameworks, libraries, tools).',
    );
  });
});

describe('writeProjectConfigKey', () => {
  it('sets the key, keeping the other keys in their order, as JSON with two spaces', () => {
    withConfig('{"name":"demo","stack":{"language":{"name":"Go"}},"envs":[]}', (projectsDir, file) => {
      writeProjectConfigKey(projectsDir, 'demo', 'stack', STACK);

      expect(fs.readFileSync(file, 'utf8')).toBe(
        `${JSON.stringify({ name: 'demo', stack: STACK, envs: [] }, null, 2)}\n`,
      );
      expect(PROJECT_CONFIG_KEYS).toEqual(['stack']);
    });
  });

  it('leaves the file untouched on an unknown key, a value outside the rule or a config that is not an object', () => {
    withConfig('{"name":"demo"}', (projectsDir, file) => {
      expect(() => {
        writeProjectConfigKey(projectsDir, 'demo', 'envs', []);
      }).toThrow('config.envs não pode ser gravado (aceitos: stack).');
      expect(() => {
        writeProjectConfigKey(projectsDir, 'demo', 'stack', { tools: [] });
      }).toThrow('config.stack.language é obrigatório');
      expect(fs.readFileSync(file, 'utf8')).toBe('{"name":"demo"}');

      fs.writeFileSync(file, '[]');
      expect(() => {
        writeProjectConfigKey(projectsDir, 'demo', 'stack', STACK);
      }).toThrow(`${file}: o conteúdo precisa ser um objeto JSON.`);
      expect(() => {
        writeProjectConfigKey(projectsDir, 'outro', 'stack', STACK);
      }).toThrow('Projeto "outro" não encontrado');
    });
  });
});
