import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stringify } from 'yaml';

import { ANSI_COLORS } from '@choliba/core';

import { SUPPORTED_AGENT_YAML_VERSIONS, validateAgentYamlV1 } from '../../agents/agent-validation';

const FULL = `version: 1

agent:
  id: qa-e2e
  name: QA E2E
  version: 1.0.0
  description: >-
    Agente especializado em engenharia de QA autônoma para escrita, atualização
    e validação de testes end-to-end (E2E) com Playwright a partir dos critérios
    de aceite de um ticket.json.

models:
  - claude-sonnet-5

role: |
  Você escreve os testes E2E do ticket \${TICKET}.
context:
  - O projeto é \${PROJECT}.
input: |
  O ticket e os critérios.
flow: |
  1. Leia o ticket.
  2. Escreva os testes.
output: |
  Um spec por ticket.
notes:
  - Nada de seletor CSS.

skills:
  playwright-cli:
    instructions: |
      Rode bunx choliba playwright-cli.
  playwright-trace:
mcps:
  mcp-app:
    tools: [jira_get_issue]
    instructions: Use quando o pedido citar uma issue.

permissions:
  allow:
    read:  ['\${PROJECT_DIR}/', '\${APP_DIR}/']
    write: ['\${PROJECT_DIR}/tests/']
    execute:
      '\${CHOL_ROOT}/': [bunx choliba tests, bunx choliba playwright-cli]
      '\${APP_DIR}/':   [git log, git diff]
  deny:
    write: ['\${APP_DIR}/', '\${PROJECT_DIR}/tickets/']
    execute:
      /etc/: ['*']

modes:
  allow: [execute, plan]
  default: execute

task:
  required: false
  default: Escreva os testes do ticket.

ticket_types: [story, bug, improvement]

steps:
  execute:
    before:
      - add_files: [ticket, '\${TICKET_FILE}']
    after:
      success:
        - run: [bunx, choliba, tests, '\${PROJECT}:\${TICKET}']
      failure:
        - run: [bunx, choliba, report, '\${AGENT_EXIT_CODE}']
      always:
        - run: [rm, -f, .cache/qa-e2e/tmp]
  plan:
    after:
      - run: [rm, -f, .cache/qa-e2e/tmp]
`;

type Doc = Record<string, unknown>;

function minimal(): Doc {
  return {
    version: 1,
    agent: { id: 'qa-e2e', name: 'QA E2E', version: '1.0.0', description: 'Escreve testes.' },
    models: ['claude-sonnet-5'],
    role: 'Papel.',
    input: 'Entrada.',
    flow: '1. Faça.',
    output: 'Saída.',
  };
}

function validate(doc: Doc, folder = 'qa-e2e') {
  return validateAgentYamlV1(stringify(doc), folder);
}

function errorsOf(doc: Doc, folder?: string): string {
  return validate(doc, folder).errors.join('\n');
}

describe('agent.color', () => {
  const agent = { id: 'qa-e2e', name: 'QA E2E', version: '1.0.0', description: 'Escreve testes.' };

  it('takes one of the colors of the theme, and nothing else', () => {
    expect(validate({ ...minimal(), agent: { ...agent, color: 'bright-cyan' } })).toEqual({ valid: true, errors: [] });
    expect(errorsOf({ ...minimal(), agent: { ...agent, color: 'purple' } })).toMatch(/color/);
  });

  it('lists exactly the colors the theme has', () => {
    const schemaFile = join(__dirname, '..', '..', '..', 'schemes', 'v1', 'agent.schema.json');
    const schema = JSON.parse(readFileSync(schemaFile, 'utf8')) as {
      properties: { agent: { properties: { color: { enum: readonly string[] } } } };
    };
    expect(schema.properties.agent.properties.color.enum).toEqual(ANSI_COLORS);
  });
});

describe('validateAgentYamlV1', () => {
  it('accepts the complete example of the standard', () => {
    expect(validateAgentYamlV1(FULL, 'qa-e2e')).toEqual({ valid: true, errors: [] });
  });

  it('accepts a file with only the required keys', () => {
    expect(validate(minimal())).toEqual({ valid: true, errors: [] });
  });

  it('supports standard 1 only', () => {
    expect(SUPPORTED_AGENT_YAML_VERSIONS).toEqual([1]);
  });

  it.each([
    ['missing', undefined, 'padrão (ausente) não suportado; suportados: 1'],
    ['unknown', 2, 'padrão 2 não suportado; suportados: 1'],
    ['a string', '1', 'padrão "1" não suportado; suportados: 1'],
  ])('rejects a version that is %s, and says only that', (_case, version, message) => {
    const doc = { ...minimal(), version };
    expect(validate(doc)).toEqual({ valid: false, errors: [message] });
  });

  it('requires version to be the first key', () => {
    const { version, ...rest } = minimal();
    expect(validate({ ...rest, version })).toEqual({
      valid: false,
      errors: ['"version" precisa ser a primeira chave'],
    });
  });

  it('rejects text that is not YAML or not a map', () => {
    expect(validateAgentYamlV1('a: [', 'qa-e2e').errors[0]).toMatch(/^YAML inválido/);
    expect(validateAgentYamlV1('- a', 'qa-e2e')).toEqual({
      valid: false,
      errors: ['(raiz) precisa ser um mapa de chaves'],
    });
  });

  it('requires agent.id to be the folder name', () => {
    expect(errorsOf(minimal(), 'outra')).toBe('/agent/id "qa-e2e" precisa ser igual ao nome da pasta "outra"');
  });

  it('requires the agent block and each of its keys', () => {
    const { agent: _agent, ...rest } = minimal();
    expect(errorsOf(rest)).toContain("must have required property 'agent'");
    expect(errorsOf({ ...minimal(), agent: { id: 'qa-e2e' } })).toContain("must have required property 'version'");
  });

  it('rejects an agent version that is not semver', () => {
    const doc = minimal();
    expect(errorsOf({ ...doc, agent: { ...(doc['agent'] as Doc), version: '1.0' } })).toContain('/agent/version');
  });

  it.each([
    ['project', { project: { required: true } }],
    ['phases', { phases: {} }],
    ['policy', { policy: 'edits' }],
    ['supported_models', { supported_models: ['x'] }],
  ])('rejects the key %s, which is not in the standard', (key, extra) => {
    expect(errorsOf({ ...minimal(), ...extra })).toContain(`"${key}"`);
  });

  it('requires the text of the agent, each section with some text', () => {
    const { role: _role, output: _output, ...rest } = minimal();
    expect(errorsOf(rest)).toContain("must have required property 'role'");
    expect(errorsOf(rest)).toContain("must have required property 'output'");
    expect(validate({ ...minimal(), flow: '  ' }).valid).toBe(false);
    expect(validate({ ...minimal(), context: [] }).valid).toBe(false);
    expect(validate({ ...minimal(), notes: ['Uma nota.'] }).valid).toBe(true);
  });

  it('rejects unknown keys below the root too', () => {
    expect(errorsOf({ ...minimal(), permissions: { allow: { web: ['x'] } } })).toContain('"web"');
  });

  it('takes run tools by name, each with its subcommands or every one', () => {
    const withTools = (allow: unknown, deny: unknown = {}): boolean =>
      validate({ ...minimal(), permissions: { allow: { tools: allow }, deny: { tools: deny } } }).valid;
    expect(
      withTools({ 'playwright-cli': ['*'], 'playwright-trace': ['open', 'close'] }, { 'playwright-cli': ['eval'] }),
    ).toBe(true);
    expect(withTools({}, { 'playwright-cli': ['*'] })).toBe(true);
    expect(withTools({ nope: ['*'] })).toBe(false);
    expect(withTools({ 'playwright-cli': ['*', 'open'] })).toBe(false);
    expect(withTools({ 'playwright-cli': [] })).toBe(false);
    expect(withTools(['playwright-cli'])).toBe(false);
  });

  it('accepts mcps as a list of names or a map to tools, instructions or null', () => {
    expect(validate({ ...minimal(), mcps: ['mcp-app'] }).valid).toBe(true);
    expect(validate({ ...minimal(), mcps: { 'mcp-app': null, other: { tools: ['a'] } } }).valid).toBe(true);
    expect(validate({ ...minimal(), mcps: { 'mcp-app': { instructions: 'Use.' } } }).valid).toBe(true);
    expect(validate({ ...minimal(), mcps: { 'mcp-app': { tools: [] } } }).valid).toBe(false);
    expect(validate({ ...minimal(), mcps: { 'mcp-app': {} } }).valid).toBe(false);
  });

  it('accepts skills as a list of names or a map to instructions or null', () => {
    expect(validate({ ...minimal(), skills: ['s'] }).valid).toBe(true);
    expect(validate({ ...minimal(), skills: { s: null, t: { instructions: 'Use t.' } } }).valid).toBe(true);
    expect(validate({ ...minimal(), skills: { s: {} } }).valid).toBe(false);
    expect(validate({ ...minimal(), skills: { s: { tools: ['a'] } } }).valid).toBe(false);
  });

  describe('permissions.execute', () => {
    it('rejects a directory with no commands in allow', () => {
      expect(errorsOf({ ...minimal(), permissions: { allow: { execute: { './': [] } } } })).toContain(
        '/permissions/allow/execute',
      );
    });

    it("accepts '*' only as the whole list, and only in deny", () => {
      const deny = (list: string[]) => ({ ...minimal(), permissions: { deny: { execute: { '/etc/': list } } } });
      expect(validate(deny(['*'])).valid).toBe(true);
      expect(validate(deny(['*', 'ls'])).valid).toBe(false);
      expect(validate({ ...minimal(), permissions: { allow: { execute: { './': ['*'] } } } }).valid).toBe(false);
    });
  });

  describe('permissions.delete', () => {
    it('accepts delete as a list of paths like read and write', () => {
      expect(
        validate({
          ...minimal(),
          permissions: { allow: { delete: ['${APP_DIR}/'] }, deny: { delete: ['${APP_DIR}/secrets/'] } },
        }).valid,
      ).toBe(true);
    });
  });

  describe('allow_without_ticket', () => {
    it('accepts a boolean', () => {
      expect(validate({ ...minimal(), allow_without_ticket: true }).valid).toBe(true);
      expect(validate({ ...minimal(), allow_without_ticket: false }).valid).toBe(true);
      expect(errorsOf({ ...minimal(), allow_without_ticket: 'yes' })).toContain('/allow_without_ticket');
    });
  });

  describe('modes', () => {
    it('requires the default to be one of the allowed modes', () => {
      expect(errorsOf({ ...minimal(), modes: { allow: ['plan', 'ask'], default: 'execute' } })).toContain(
        '/modes/default',
      );
      expect(validate({ ...minimal(), modes: { allow: ['plan'], default: 'plan' } }).valid).toBe(true);
      expect(validate({ ...minimal(), modes: { default: 'ask' } }).valid).toBe(true);
    });

    it('rejects an empty, repeated or unknown list of modes', () => {
      expect(validate({ ...minimal(), modes: { allow: [] } }).valid).toBe(false);
      expect(validate({ ...minimal(), modes: { allow: ['plan', 'plan'] } }).valid).toBe(false);
      expect(validate({ ...minimal(), modes: { allow: ['run'] } }).valid).toBe(false);
    });
  });

  it('requires a default task when the task is not required', () => {
    expect(errorsOf({ ...minimal(), task: { required: false } })).toContain("must have required property 'default'");
    expect(validate({ ...minimal(), task: { required: true } }).valid).toBe(true);
  });

  it('accepts only the ticket types that have a template', () => {
    expect(validate({ ...minimal(), ticket_types: ['bug', 'task'] }).valid).toBe(true);
    expect(errorsOf({ ...minimal(), ticket_types: ['feature'] })).toContain('/ticket_types/0');
  });

  describe('steps', () => {
    const steps = (value: Doc) => ({ ...minimal(), steps: value });

    it('are declared per mode', () => {
      expect(validate(steps({ execute: { before: [{ run: ['a'] }] }, ask: {} })).valid).toBe(true);
      expect(errorsOf(steps({ before: [{ run: ['a'] }] }))).toContain('"before"');
      expect(errorsOf(steps({ run: {} }))).toContain('"run"');
    });

    it('require each mode they name to be one of the allowed modes', () => {
      const doc = { ...steps({ plan: { after: [{ run: ['a'] }] } }), modes: { allow: ['execute'] } };
      expect(errorsOf(doc)).toBe('/steps/plan: o modo "plan" não está em modes.allow');
    });

    it('take after as a list or as success, failure and always blocks', () => {
      expect(validate(steps({ execute: { after: [{ run: ['a'] }] } })).valid).toBe(true);
      expect(validate(steps({ execute: { after: { failure: [{ run: ['a'] }] } } })).valid).toBe(true);
      expect(validate(steps({ execute: { after: {} } })).valid).toBe(false);
      expect(validate(steps({ execute: { after: { finally: [{ run: ['a'] }] } } })).valid).toBe(false);
    });

    it('rejects a step with two actions', () => {
      expect(validate(steps({ execute: { before: [{ run: ['a'], add_files: ['t', 'x'] }] } })).valid).toBe(false);
    });

    it('accepts each action only where it runs', () => {
      expect(
        validate(
          steps({
            execute: {
              before: [{ git_diff: ['develop', 'd.patch'] }],
              after: { success: [{ record_git_head: ['h'] }] },
            },
          }),
        ).valid,
      ).toBe(true);
      expect(validate(steps({ execute: { after: [{ add_files: ['t', 'x'] }] } })).valid).toBe(false);
      expect(validate(steps({ execute: { before: [{ record_git_head: ['h'] }] } })).valid).toBe(false);
    });

    it('checks the number of arguments of each action', () => {
      expect(validate(steps({ execute: { before: [{ add_files: ['t'] }] } })).valid).toBe(false);
      expect(validate(steps({ execute: { after: [{ record_git_head: ['a', 'b'] }] } })).valid).toBe(false);
      expect(validate(steps({ execute: { before: [{ run: [] }] } })).valid).toBe(false);
    });
  });
});
