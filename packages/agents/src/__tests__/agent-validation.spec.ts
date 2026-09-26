import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ErrorObject } from 'ajv';

import { loadAgent } from '../agent-loader';
import {
  AGENT_SCHEMA_FILE,
  agentSchemaFor,
  formatAgentYamlSchemaError,
  mapAgentYamlSchemaErrors,
  validateAgentFiles,
  validateAgentYaml,
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

describe('validateAgentYaml', () => {
  it('returns valid for schema-conformant yaml', () => {
    const result = validateAgentYaml(
      ['id: x', 'name: X', 'version: 1.0.0', 'description: d', 'supported_models: [m]'].join('\n'),
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts mcps as a list of names or as a map of servers with optional tools, and rejects empty tools', () => {
    const base = ['id: x', 'name: X', 'version: 1.0.0', 'description: d', 'supported_models: [m]'];
    const valid = (...lines: string[]): boolean => validateAgentYaml([...base, ...lines].join('\n')).valid;

    expect(valid('mcps: [app]')).toBe(true);
    expect(valid('mcps:', '  app:', '    tools: [jira_search]', '  browser:')).toBe(true);
    expect(valid('mcps:', '  app:', '    tools: []')).toBe(false);
    expect(valid('mcps:', '  app:', '    tool: [x]')).toBe(false);
  });

  it('accepts ticket_types as a non-empty list of names', () => {
    const base = ['id: x', 'name: X', 'version: 1.0.0', 'description: d', 'supported_models: [m]'];

    expect(validateAgentYaml([...base, 'ticket_types: [bug, story]'].join('\n')).valid).toBe(true);
    expect(validateAgentYaml([...base, 'ticket_types: []'].join('\n')).valid).toBe(false);
  });
});

describe('validateAgentFiles integration', () => {
  it('aggregates yaml and system.md errors from both files', async () => {
    const result = await validateAgentFiles('/nope', 'missing');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns valid for a well-formed agent directory', async () => {
    const result = await validateAgentFiles(FIXTURES, 'with-prepare');

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("validates each phase's system file instead of system.md, and reports the missing ones", async () => {
    expect(await validateAgentFiles(FIXTURES, 'with-phases')).toEqual({ valid: true, errors: [] });

    const tmp = makeTmpDir('agent-validation-phases');
    try {
      const agentDir = join(tmp.path, 'phased');
      mkdirSync(agentDir, { recursive: true });
      const yaml = readFileSync(join(FIXTURES, 'with-phases', 'agent.yaml'), 'utf8');
      writeFileSync(join(agentDir, 'agent.yaml'), yaml);
      writeFileSync(join(agentDir, 'red.md'), '<not-xml');

      const result = await validateAgentFiles(tmp.path, 'phased');

      expect(result.errors.some((error) => error.includes('red.md (schema '))).toBe(true);
      expect(result.errors).toContain(`${join(agentDir, 'green.md')}: arquivo não encontrado`);
      expect(result.errors.some((error) => error.includes('system.md'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('falls back to system.md when agent.yaml does not parse, and skips a phase that names no file', async () => {
    const tmp = makeTmpDir('agent-validation-odd');
    try {
      const agentDir = join(tmp.path, 'odd');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'agent.yaml'), 'id: [unclosed');
      const unparsable = await validateAgentFiles(tmp.path, 'odd');
      expect(unparsable.errors).toContain(`${join(agentDir, 'system.md')}: arquivo não encontrado`);

      writeFileSync(join(agentDir, 'agent.yaml'), 'phases:\n  red: x\n  green:\n    system: 3\n');
      const malformed = await validateAgentFiles(tmp.path, 'odd');
      expect(malformed.errors.some((error) => error.includes('.md'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('prefixes schema errors with each file path when yaml or system.md is invalid', async () => {
    const tmp = makeTmpDir('agent-validation-invalid');
    try {
      const agentDir = join(tmp.path, 'broken-agent');
      mkdirSync(agentDir, { recursive: true });
      writeFileSync(join(agentDir, 'agent.yaml'), 'id: only-id\n');
      writeFileSync(join(agentDir, 'system.md'), '<not-xml');

      const result = await validateAgentFiles(tmp.path, 'broken-agent');

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.includes('agent.yaml:'))).toBe(true);
      expect(result.errors.some((error) => error.includes('system.md (schema '))).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  it('validates yaml through validateAgentYaml when the file exists', () => {
    const result = validateAgentYaml('id: [unclosed');

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('YAML inválido');
  });

  it('validates system.md through validateSystemMd', async () => {
    const result = await validateSystemMd('<not-valid-xml');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('per-agent schema', () => {
  const REPO_AGENTS = join(__dirname, '..', '..', '..', '..', 'agents');
  const docsUpdaterText = readFileSync(join(REPO_AGENTS, 'docs-updater', 'system.md'), 'utf8');
  const withoutDocsMap = docsUpdaterText.replace(/<docs_map>[\s\S]*?<\/docs_map>\s*/, '');

  it('uses the default agent.xsd, where docs_map is optional', async () => {
    const tmp = makeTmpDir('agent-schema-default');
    try {
      expect(agentSchemaFor(tmp.path).path).toMatch(/schemes[/\\]agent\.xsd$/);
      expect(withoutDocsMap).not.toContain('<docs_map>');
      expect(await validateSystemMd(withoutDocsMap)).toEqual({ valid: true, errors: [] });
    } finally {
      tmp.cleanup();
    }
  });

  it("uses the agent's own system.xsd, which can make docs_map required", async () => {
    const schema = agentSchemaFor(join(REPO_AGENTS, 'docs-updater'));

    expect(schema.path).toBe(join(REPO_AGENTS, 'docs-updater', AGENT_SCHEMA_FILE));
    expect(await validateSystemMd(docsUpdaterText, schema)).toEqual({ valid: true, errors: [] });
    const missing = await validateSystemMd(withoutDocsMap, schema);
    expect(missing.valid).toBe(false);
    expect(missing.errors.join(' ')).toContain('docs_map');
  });

  it('makes loadAgent fail, naming the schema, when system.md breaks the agent own schema', async () => {
    const tmp = makeTmpDir('agent-schema-load');
    try {
      const dir = join(tmp.path, 'docs-updater');
      mkdirSync(dir);
      writeFileSync(join(dir, 'agent.yaml'), readFileSync(join(REPO_AGENTS, 'docs-updater', 'agent.yaml'), 'utf8'));
      writeFileSync(join(dir, AGENT_SCHEMA_FILE), readFileSync(join(REPO_AGENTS, 'docs-updater', AGENT_SCHEMA_FILE), 'utf8'));
      writeFileSync(join(dir, 'system.md'), withoutDocsMap);

      await expect(loadAgent(tmp.path, 'docs-updater')).rejects.toThrow(`(schema ${join(dir, AGENT_SCHEMA_FILE)})`);
      writeFileSync(join(dir, 'system.md'), docsUpdaterText);
      await expect(loadAgent(tmp.path, 'docs-updater')).resolves.toMatchObject({ name: 'docs-updater' });
    } finally {
      tmp.cleanup();
    }
  });
});
