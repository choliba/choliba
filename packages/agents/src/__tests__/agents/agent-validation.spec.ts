import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ErrorObject } from 'ajv';

import {
  formatAgentYamlSchemaError,
  mapAgentYamlSchemaErrors,
  validateAgentFiles,
} from '../../agents/agent-validation';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

describe('mapAgentYamlSchemaErrors', () => {
  it('returns an empty list when AJV provides no errors array', () => {
    expect(mapAgentYamlSchemaErrors(undefined)).toEqual([]);
    expect(mapAgentYamlSchemaErrors(null)).toEqual([]);
  });
});

describe('formatAgentYamlSchemaError', () => {
  it('formats root, path, additionalProperties and missing-message cases', () => {
    expect(
      formatAgentYamlSchemaError({
        instancePath: '',
        keyword: 'required',
        message: 'must have required property',
        params: {},
        schemaPath: '',
      } as ErrorObject),
    ).toBe('(raiz) must have required property');

    expect(
      formatAgentYamlSchemaError({
        instancePath: '/policy',
        keyword: 'enum',
        message: 'must be equal to one of the allowed values',
        params: {},
        schemaPath: '',
      } as ErrorObject),
    ).toContain('/policy');

    expect(
      formatAgentYamlSchemaError({
        instancePath: '',
        keyword: 'additionalProperties',
        message: 'must NOT have additional properties',
        params: { additionalProperty: 'goiaba' },
        schemaPath: '',
      } as ErrorObject),
    ).toContain('"goiaba"');

    const errorWithoutMessage = {
      instancePath: '',
      keyword: 'additionalProperties',
      params: { additionalProperty: 1 },
      schemaPath: '',
    } satisfies Omit<ErrorObject, 'message'>;
    expect(formatAgentYamlSchemaError(errorWithoutMessage as ErrorObject)).toBe('(raiz) inválido');
  });
});

describe('validateAgentFiles integration', () => {
  it('reports the agent.yaml of an agent directory that does not exist', () => {
    expect(validateAgentFiles('/nope', 'missing')).toEqual({
      valid: false,
      errors: [`${join('/nope', 'missing', 'agent.yaml')}: arquivo não encontrado`],
    });
  });

  it('returns valid for a well-formed agent directory', () => {
    expect(validateAgentFiles(FIXTURES, 'with-prepare')).toEqual({ valid: true, errors: [] });
  });

  it('prefixes every error with the path of agent.yaml, the folder checked as the agent id', () => {
    const tmp = makeTmpDir('agent-validation-invalid');
    try {
      const agentDir = join(tmp.path, 'broken-agent');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'agent.yaml'), readFileSync(join(FIXTURES, 'reviewer', 'agent.yaml'), 'utf8'));

      expect(validateAgentFiles(tmp.path, 'broken-agent')).toEqual({
        valid: false,
        errors: [
          `${join(agentDir, 'agent.yaml')}: /agent/id "reviewer" precisa ser igual ao nome da pasta "broken-agent"`,
        ],
      });
    } finally {
      tmp.cleanup();
    }
  });
});

describe('the agents of this repository', () => {
  const REPO_AGENTS = join(__dirname, '..', '..', '..', '..', '..', '.choliba', 'agents');

  it.each(['product-owner', 'test-writer', 'implementer', 'docs-updater'])('%s is a valid agent.yaml', (name) => {
    expect(validateAgentFiles(REPO_AGENTS, name)).toEqual({ valid: true, errors: [] });
  });
});
