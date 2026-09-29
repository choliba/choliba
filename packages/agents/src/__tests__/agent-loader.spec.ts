import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { stringify } from 'yaml';

import {
  AgentConfigError,
  isValidAgentName,
  listAgents,
  loadAgent,
  parseAgentYaml,
  policyFromPermissions,
} from '../agent-loader';
import { NO_PERMISSIONS } from '../permissions';
import { makeTmpDir } from './helpers/tmp';

const FIXTURES = join(__dirname, 'fixtures/agents');

type Doc = Record<string, unknown>;

function head(extra: Doc = {}): Doc {
  return {
    version: 1,
    agent: { id: 'x', name: 'X', version: '1.0.0', description: 'd' },
    models: ['m'],
    ...extra,
  };
}

function parse(extra: Doc = {}) {
  return parseAgentYaml(stringify(head(extra)), 'agent.yaml', 'x');
}

/** A copy of `agents/<name>` from the fixtures, whose files a test may change. */
function withAgentCopy(name: string, test: (dir: string) => Promise<void>): Promise<void> {
  const tmp = makeTmpDir('loader');
  cpSync(join(FIXTURES, name), join(tmp.path, name), { recursive: true });
  return test(tmp.path).finally(tmp.cleanup);
}

describe('isValidAgentName', () => {
  it('accepts lowercase names with digits, dash and underscore', () => {
    expect(isValidAgentName('implementer')).toBe(true);
    expect(isValidAgentName('test-writer')).toBe(true);
    expect(isValidAgentName('agent_2')).toBe(true);
  });

  it('rejects path traversal and empty names', () => {
    expect(isValidAgentName('..')).toBe(false);
    expect(isValidAgentName('../etc')).toBe(false);
    expect(isValidAgentName('a/b')).toBe(false);
    expect(isValidAgentName('')).toBe(false);
    expect(isValidAgentName('Implementer')).toBe(false);
  });
});

describe('parseAgentYaml', () => {
  it('reads a file with only the required keys, with the defaults of the standard', () => {
    expect(parse()).toEqual({
      id: 'x',
      displayName: 'X',
      version: '1.0.0',
      description: 'd',
      supportedModels: ['m'],
      skills: [],
      mcps: [],
      permissions: NO_PERMISSIONS,
      policy: 'read-only',
      taskRequired: true,
      modes: ['execute', 'plan', 'ask'],
      defaultMode: 'execute',
    });
  });

  it('reads every key of the standard', () => {
    const fields = parse({
      skills: ['s'],
      mcps: { app: { tools: ['t'] }, other: null },
      permissions: {
        allow: { read: ['r/'], write: ['w/'], execute: { './': ['git diff'] } },
        deny: { read: ['nr/'], write: ['nw/'], execute: { '/etc/': ['*'] } },
      },
      modes: { allow: ['plan', 'ask'], default: 'ask' },
      task: { required: false, default: 'Faça.' },
      ticket_types: ['story'],
      steps: { before: [{ add_files: ['t', 'x.md'] }], after: [{ run: ['echo', 'a'] }] },
    });

    expect(fields).toMatchObject({
      skills: ['s'],
      mcps: [{ name: 'app', tools: ['t'] }, { name: 'other' }],
      permissions: {
        allowRead: ['r/'],
        allowWrite: ['w/'],
        allowExecute: [{ dir: './', commands: ['git diff'] }],
        denyRead: ['nr/'],
        denyWrite: ['nw/'],
        denyExecute: [{ dir: '/etc/', commands: ['*'] }],
      },
      policy: 'edits',
      taskRequired: false,
      defaultTask: 'Faça.',
      ticketTypes: ['story'],
      modes: ['plan', 'ask'],
      defaultMode: 'ask',
      beforeExecute: [{ action: 'add_files', args: ['t', 'x.md'] }],
      afterExecute: [{ action: 'run', args: ['echo', 'a'] }],
    });
  });

  it('reads mcps given as a list of names', () => {
    expect(parse({ mcps: ['app'] }).mcps).toEqual([{ name: 'app' }]);
  });

  it('defaults the mode to execute when allowed, else to the first allowed', () => {
    expect(parse({ modes: { allow: ['ask', 'execute'] } }).defaultMode).toBe('execute');
    expect(parse({ modes: { allow: ['plan', 'ask'] } }).defaultMode).toBe('plan');
  });

  it('rejects a file that breaks the standard, naming the file and every problem', () => {
    const action = () => parseAgentYaml(stringify({ ...head(), policy: 'edits', phases: {} }), 'dir/agent.yaml', 'x');
    expect(action).toThrow(AgentConfigError);
    expect(action).toThrow(/^dir\/agent\.yaml: .*"policy".*\n.*"phases"/);
  });

  it('rejects a file of another standard with only that reason', () => {
    expect(() => parseAgentYaml('id: x\nname: X\n', 'agent.yaml', 'x')).toThrow(
      'agent.yaml: padrão (ausente) não suportado; suportados: 1',
    );
  });

  it('rejects an agent.id that is not the folder', () => {
    expect(() => parseAgentYaml(stringify(head()), 'agent.yaml', 'y')).toThrow(/pasta "y"/);
  });

  it("rejects a step the action's own rules refuse", () => {
    expect(() => parse({ steps: { before: [{ git_diff: ['develop', 'd.patch', '--bogus'] }] } })).toThrow(
      /"steps": esperado "git_diff/,
    );
  });
});

describe('policyFromPermissions', () => {
  it('is edits with a write path and read-only otherwise', () => {
    expect(policyFromPermissions({ ...NO_PERMISSIONS, allowWrite: ['docs/'] })).toBe('edits');
    expect(policyFromPermissions({ ...NO_PERMISSIONS, allowRead: ['docs/'] })).toBe('read-only');
  });
});

describe('loadAgent', () => {
  it('loads an agent with skills', async () => {
    const agent = await loadAgent(FIXTURES, 'echo');

    expect(agent).toMatchObject({
      name: 'echo',
      id: 'echo',
      displayName: 'Echo Agent',
      version: '1.0.0',
      skills: ['dummy-skill'],
      policy: 'read-only',
      projectRequired: false,
    });
    expect(agent.instructions).toContain('agente de eco');
    expect(agent.dir).toBe(join(FIXTURES, 'echo'));
    expect(agent.systemPromptPath).toBe(join(FIXTURES, 'echo', 'system.md'));
  });

  it('loads an agent with no skills as an empty array', async () => {
    expect((await loadAgent(FIXTURES, 'reviewer')).skills).toEqual([]);
  });

  it('needs a project when agent.yaml uses a project variable', async () => {
    expect((await loadAgent(FIXTURES, 'with-project')).projectRequired).toBe(true);
    expect((await loadAgent(FIXTURES, 'with-vars')).projectRequired).toBe(false);
  });

  it('needs a project when system.md uses a project variable or the agent works on tickets', async () => {
    await withAgentCopy('echo', async (dir) => {
      const system = join(dir, 'echo', 'system.md');
      writeFileSync(
        system,
        '<agent><system_role>Leia ${PROJECT_DIR}/config.json.</system_role><tool_definitions><intro>i</intro><preparation><item>p</item></preparation><notes><note>n</note></notes></tool_definitions><input_contract>i</input_contract><execution_flow>e</execution_flow><output_contract>o</output_contract></agent>',
      );
      expect((await loadAgent(dir, 'echo')).projectRequired).toBe(true);
    });
    await withAgentCopy('reviewer', async (dir) => {
      const yaml = stringify({
        ...head(),
        agent: { id: 'reviewer', name: 'R', version: '1.0.0', description: 'd' },
        ticket_types: ['bug'],
      });
      writeFileSync(join(dir, 'reviewer', 'agent.yaml'), yaml);
      expect((await loadAgent(dir, 'reviewer')).projectRequired).toBe(true);
    });
  });

  it('refuses an agent that uses a ticket variable but declares no ticket_types, saying why', async () => {
    await withAgentCopy('with-project', async (dir) => {
      const yaml = join(dir, 'with-project', 'agent.yaml');
      writeFileSync(yaml, readFileSync(yaml, 'utf8').replace('${PROJECT_DIR}/tickets/', '${TICKET_FILE}'));

      await expect(loadAgent(dir, 'with-project')).rejects.toThrow(
        /agent "with-project" usa \$\{TICKET\} ou \$\{TICKET_FILE\}, mas não declara ticket_types/,
      );
      writeFileSync(yaml, `${readFileSync(yaml, 'utf8')}ticket_types: [bug]\n`);
      await expect(loadAgent(dir, 'with-project')).resolves.toMatchObject({ ticketTypes: ['bug'] });
    });
  });

  it('rejects an invalid name before touching the filesystem', async () => {
    await expect(loadAgent(FIXTURES, '../etc')).rejects.toThrow(/invalid agent name/);
  });

  it('reports a missing agent directory', async () => {
    await expect(loadAgent(FIXTURES, 'does-not-exist')).rejects.toThrow(/not found/);
  });

  it('reports which keys are missing, naming the file', async () => {
    await expect(loadAgent(FIXTURES, 'broken')).rejects.toThrow(/broken\/agent\.yaml: .*'models'/);
  });

  it('reports a missing system.md, distinct from a missing agent.yaml', async () => {
    await expect(loadAgent(FIXTURES, 'no-system-md')).rejects.toThrow(/is missing .*system\.md/);
  });

  it('rejects an agent whose agent.yaml has a key the standard does not allow', async () => {
    await expect(loadAgent(FIXTURES, 'schema-invalid-yaml')).rejects.toThrow(/"bogus_field"/);
  });

  it('rejects an agent whose system.md is not valid per the XSD', async () => {
    await expect(loadAgent(FIXTURES, 'schema-invalid-xml')).rejects.toThrow(/failed schema validation/);
  });
});

describe('listAgents', () => {
  it('lists every well-formed agent, sorted, skipping "_"-prefixed, malformed and non-directory entries', async () => {
    const agents = await listAgents(FIXTURES);

    expect(agents.map((a) => a.name)).toEqual(['echo', 'reviewer', 'with-prepare', 'with-project', 'with-vars']);
  });

  it('returns an empty list for a directory that does not exist', async () => {
    expect(await listAgents(join(FIXTURES, 'nope'))).toEqual([]);
  });
});
