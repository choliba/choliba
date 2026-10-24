import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentStep } from '@choliba/domain';
import { answerJson, writeConfig } from '../../steps/step-write-config';
import { makeTmpDir } from '../helpers/tmp';

const STEP: AgentStep = { action: 'write_config', args: [], options: { key: 'stack' } };

describe('answerJson', () => {
  it('reads the answer as JSON, without a code block that wraps it', () => {
    expect(answerJson('```json\n{ "language": "PHP" }\n```')).toEqual({ language: 'PHP' });
  });

  it('fails with no answer, or one that is not JSON', () => {
    expect(() => answerJson(undefined)).toThrow('o agente não deu resposta para gravar');
    expect(() => answerJson('  ')).toThrow('o agente não deu resposta para gravar');
    expect(() => answerJson('# Tecnologias')).toThrow('a resposta do agente não é um JSON:');
  });
});

describe('writeConfig', () => {
  it("saves the answer as the key of the run's project's config.json, through @choliba/workspace", () => {
    const projects = makeTmpDir('write-config');
    const file = join(projects.path, 'demo', 'config.json');
    try {
      mkdirSync(join(projects.path, 'demo'));
      writeFileSync(file, '{"name":"demo"}');

      writeConfig(
        { projectsDir: projects.path, name: 'demo' },
        '{"language":{"name":"PHP"},"frameworks":[{"name":"Yii","version":"^1.1"}]}',
        STEP,
      );

      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
        name: 'demo',
        stack: {
          language: { name: 'PHP', version: '', url: '' },
          frameworks: [{ name: 'Yii', version: '^1.1', url: '' }],
          libraries: [],
          tools: [],
        },
      });
    } finally {
      projects.cleanup();
    }
  });

  it('fails without a project', () => {
    expect(() => {
      writeConfig(undefined, '{}', STEP);
    }).toThrow('write_config grava no config.json do projeto: rode com --project');
  });
});
