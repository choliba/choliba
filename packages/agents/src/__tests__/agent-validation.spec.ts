import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ErrorObject } from 'ajv';

import {
  formatAgentYamlSchemaError,
  mapAgentYamlSchemaErrors,
  validateAgentFiles,
  validateSystemMd,
} from '../agent-validation';
import { makeTmpDir } from './helpers/tmp';

const FIXTURES = join(__dirname, 'fixtures', 'agents');

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
  it('reports both files of an agent directory that does not exist', async () => {
    const result = await validateAgentFiles('/nope', 'missing');

    expect(result).toEqual({
      valid: false,
      errors: [
        `${join('/nope', 'missing', 'agent.yaml')}: arquivo não encontrado`,
        `${join('/nope', 'missing', 'system.md')}: arquivo não encontrado`,
      ],
    });
  });

  it('returns valid for a well-formed agent directory', async () => {
    const result = await validateAgentFiles(FIXTURES, 'with-prepare');

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('prefixes the errors of each file with its path, the folder checked as the agent id', async () => {
    const tmp = makeTmpDir('agent-validation-invalid');
    try {
      const agentDir = join(tmp.path, 'broken-agent');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'agent.yaml'), readFileSync(join(FIXTURES, 'reviewer', 'agent.yaml'), 'utf8'));
      writeFileSync(join(agentDir, 'system.md'), '<not-xml');

      const result = await validateAgentFiles(tmp.path, 'broken-agent');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe(
        `${join(agentDir, 'agent.yaml')}: /agent/id "reviewer" precisa ser igual ao nome da pasta "broken-agent"`,
      );
      expect(result.errors.slice(1).every((error) => error.startsWith(`${join(agentDir, 'system.md')}: `))).toBe(true);
      expect(result.errors.length).toBeGreaterThan(1);
    } finally {
      tmp.cleanup();
    }
  });

  it('validates system.md through validateSystemMd', async () => {
    const result = await validateSystemMd('<not-valid-xml');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('system.md schema', () => {
  const REPO_AGENTS = join(__dirname, '..', '..', '..', '..', 'agents');
  const docsUpdaterText = readFileSync(join(REPO_AGENTS, 'docs-updater', 'system.md'), 'utf8');

  it('accepts a system.md with or without docs_map', async () => {
    const withoutDocsMap = docsUpdaterText.replace(/<docs_map>[\s\S]*?<\/docs_map>\s*/, '');

    expect(withoutDocsMap).not.toContain('<docs_map>');
    expect(await validateSystemMd(docsUpdaterText)).toEqual({ valid: true, errors: [] });
    expect(await validateSystemMd(withoutDocsMap)).toEqual({ valid: true, errors: [] });
  });

  it('no longer accepts <permissions>, which moved to agent.yaml', async () => {
    const withPermissions = docsUpdaterText.replace(
      '<tool_definitions>',
      '<permissions><intro>x</intro></permissions>\n<tool_definitions>',
    );

    const result = await validateSystemMd(withPermissions);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('permissions');
  });
});
