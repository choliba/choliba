import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Writable } from '@choliba/terminal';

import { AgentConfigError } from '../../../agents/agent-loader';
import { printAgentDefinition, validateAgentFiles, validateAgentYamlV1 } from '../../../agents/commands/agent';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'agents');

function fakeWritable(): Writable & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
}

describe('printAgentDefinition', () => {
  it('reads agent.yaml and writes the agent definition as JSON: identity first, then where it is and its text', () => {
    const stdout = fakeWritable();

    printAgentDefinition(FIXTURES, 'echo', stdout);

    const raw = stdout.chunks.join('');
    const printed = JSON.parse(raw) as Record<string, unknown>;
    expect(printed).toMatchObject({
      id: 'echo',
      name: 'echo',
      displayName: 'Echo Agent',
      version: '1.0.0',
      description: 'Repete a tarefa recebida, usado nos testes deste pacote.',
      supportedModels: ['claude-3-5-sonnet', 'gpt-4o'],
      skills: [{ name: 'dummy-skill' }],
      mcps: [],
      dir: join(FIXTURES, 'echo'),
      sourcePath: join(FIXTURES, 'echo', 'agent.yaml'),
      sections: { role: expect.stringContaining('agente de eco') as unknown },
    });
    expect(raw.indexOf('"id"')).toBeLessThan(raw.indexOf('"dir"'));
    expect(raw.indexOf('"skills"')).toBeLessThan(raw.indexOf('"sections"'));
  });

  it('throws when the name does not exist under agentsDir', () => {
    const stdout = fakeWritable();

    expect(() => {
      printAgentDefinition(FIXTURES, 'nao-existe', stdout);
    }).toThrow(AgentConfigError);
    expect(stdout.chunks).toEqual([]);
  });

  it('throws for an empty name instead of silently doing nothing', () => {
    const stdout = fakeWritable();

    expect(() => {
      printAgentDefinition(FIXTURES, '', stdout);
    }).toThrow(AgentConfigError);
    expect(stdout.chunks).toEqual([]);
  });
});

describe('validateAgentYamlV1', () => {
  it('validates the agent.yaml of a fixture against its folder', () => {
    const text = readFileSync(join(FIXTURES, 'reviewer', 'agent.yaml'), 'utf8');

    expect(validateAgentYamlV1(text, 'reviewer')).toEqual({ valid: true, errors: [] });
    expect(validateAgentYamlV1(text, 'outro').valid).toBe(false);
  });
});

describe('validateAgentFiles', () => {
  it('validates the with-prepare fixture', () => {
    expect(validateAgentFiles(FIXTURES, 'with-prepare')).toEqual({ valid: true, errors: [] });
  });

  it('reports a missing agent.yaml instead of throwing', () => {
    const result = validateAgentFiles(FIXTURES, 'nao-existe');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
