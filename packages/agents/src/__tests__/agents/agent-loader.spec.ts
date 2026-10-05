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
} from '../../agents/agent-loader';
import { NO_PERMISSIONS } from '../../runs/permissions';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures/agents');

type Doc = Record<string, unknown>;

const SECTIONS = { role: 'Papel.', input: 'Entrada.', flow: '1. Faça.', output: 'Saída.' };

function head(extra: Doc = {}): Doc {
  return {
    version: 1,
    agent: { id: 'x', name: 'X', version: '1.0.0', description: 'd' },
    models: ['m'],
    ...SECTIONS,
    ...extra,
  };
}

const NO_STEPS = { before: [], after: { success: [], failure: [], always: [] } };

function parse(extra: Doc = {}) {
  return parseAgentYaml(stringify(head(extra)), 'agent.yaml', 'x');
}

/** A copy of `agents/<name>` from the fixtures, whose files a test may change. */
function withAgentCopy(name: string, test: (dir: string) => void): void {
  const tmp = makeTmpDir('loader');
  cpSync(join(FIXTURES, name), join(tmp.path, name), { recursive: true });
  try {
    test(tmp.path);
  } finally {
    tmp.cleanup();
  }
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
      sections: { role: 'Papel.', context: [], input: 'Entrada.', flow: '1. Faça.', output: 'Saída.', notes: [] },
      skills: [],
      mcps: [],
      permissions: NO_PERMISSIONS,
      policy: 'read-only',
      taskRequired: true,
      allowWithoutTicket: false,
      modes: ['execute', 'plan', 'ask'],
      defaultMode: 'execute',
      steps: { execute: NO_STEPS, plan: NO_STEPS, ask: NO_STEPS },
    });
  });

  it('reads every key of the standard', () => {
    const fields = parse({
      context: ['Contexto.'],
      notes: ['Nota.'],
      skills: { s: { instructions: 'Use s.' }, plain: null },
      mcps: { app: { tools: ['t'], instructions: 'Use app.' }, other: null, docs: { instructions: 'Use docs.' } },
      permissions: {
        allow: { read: ['r/'], write: ['w/'], delete: ['d/'], execute: { './': ['git diff'] } },
        deny: { read: ['nr/'], write: ['nw/'], delete: ['nd/'], execute: { '/etc/': ['*'] } },
      },
      modes: { allow: ['plan', 'ask'], default: 'ask' },
      task: { required: false, default: 'Faça.' },
      ticket_types: ['story'],
      allow_without_ticket: true,
      steps: {
        plan: { before: [{ add_files: ['t', 'x.md'] }], after: [{ run: ['echo', 'a'] }] },
        ask: { after: { success: [{ run: ['ok'] }], failure: [{ run: ['ko', '${AGENT_EXIT_CODE}'] }] } },
      },
    });

    expect(fields).toMatchObject({
      sections: { context: ['Contexto.'], notes: ['Nota.'] },
      skills: [{ name: 's', instructions: 'Use s.' }, { name: 'plain' }],
      mcps: [
        { name: 'app', tools: ['t'], instructions: 'Use app.' },
        { name: 'other' },
        { name: 'docs', instructions: 'Use docs.' },
      ],
      permissions: {
        allowRead: ['r/'],
        allowWrite: ['w/'],
        allowDelete: ['d/'],
        allowExecute: [{ dir: './', commands: ['git diff'] }],
        denyRead: ['nr/'],
        denyWrite: ['nw/'],
        denyDelete: ['nd/'],
        denyExecute: [{ dir: '/etc/', commands: ['*'] }],
      },
      policy: 'edits',
      taskRequired: false,
      defaultTask: 'Faça.',
      ticketTypes: ['story'],
      allowWithoutTicket: true,
      modes: ['plan', 'ask'],
      defaultMode: 'ask',
      steps: {
        execute: NO_STEPS,
        plan: {
          before: [{ action: 'add_files', args: ['t', 'x.md'] }],
          after: { success: [], failure: [], always: [{ action: 'run', args: ['echo', 'a'] }] },
        },
        ask: {
          before: [],
          after: {
            success: [{ action: 'run', args: ['ok'] }],
            failure: [{ action: 'run', args: ['ko', '${AGENT_EXIT_CODE}'] }],
            always: [],
          },
        },
      },
    });
  });

  it('reads skills and mcps given as lists of names', () => {
    expect(parse({ skills: ['s'] }).skills).toEqual([{ name: 's' }]);
    expect(parse({ mcps: ['app'] }).mcps).toEqual([{ name: 'app' }]);
  });

  it('rejects a file without the text of the agent', () => {
    expect(() => parseAgentYaml(stringify({ ...head(), role: undefined, flow: undefined }), 'agent.yaml', 'x')).toThrow(
      /'role'[\s\S]*'flow'/,
    );
  });

  it('rejects a ${NAME} that is not in the catalog, or not valid where it is, naming the field', () => {
    expect(() => parse({ role: 'Use ${NOPE}.' })).toThrow(/\$\{NOPE\} \(em role\) não é uma variável do agent\.yaml/);
    expect(() => parse({ skills: { s: { instructions: '${AGENT_EXIT_CODE}' } } })).toThrow(
      /\$\{AGENT_EXIT_CODE\} só vale em steps\.<modo>\.after \(está em skills\.s\.instructions\)/,
    );
    expect(() => parse({ steps: { execute: { before: [{ run: ['x', '${AGENT_EXIT_CODE}'] }] } } })).toThrow(
      /está em steps\.execute\.before/,
    );
  });

  it('rejects a ${NAME} in a fixed value of the declaration', () => {
    expect(() =>
      parse({
        agent: { id: 'x', name: 'X', version: '1.0.0', description: 'Em ${PROJECT_DIR}.' },
        models: ['${CHOL_ROOT}'],
        task: { required: false, default: '${TICKET}' },
        mcps: { app: { tools: ['${PROJECT}'] } },
      }),
    ).toThrow(/agent não aceita[\s\S]*models não aceita[\s\S]*task não aceita[\s\S]*mcps\.tools não aceita/);
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
    expect(() => parse({ steps: { execute: { before: [{ git_diff: ['develop', 'd.patch', '--bogus'] }] } } })).toThrow(
      /"steps": esperado "git_diff/,
    );
  });
});

describe('policyFromPermissions', () => {
  it('is edits with a write path and read-only otherwise', () => {
    expect(policyFromPermissions({ ...NO_PERMISSIONS, allowWrite: ['docs/'] })).toBe('edits');
    expect(policyFromPermissions({ ...NO_PERMISSIONS, allowDelete: ['docs/'] })).toBe('edits');
    expect(policyFromPermissions({ ...NO_PERMISSIONS, allowRead: ['docs/'] })).toBe('read-only');
  });
});

describe('loadAgent', () => {
  it('loads an agent with skills, its text and where its agent.yaml is', () => {
    const agent = loadAgent(FIXTURES, 'echo');

    expect(agent).toMatchObject({
      name: 'echo',
      id: 'echo',
      displayName: 'Echo Agent',
      version: '1.0.0',
      skills: [{ name: 'dummy-skill' }],
      policy: 'read-only',
      projectRequired: false,
    });
    expect(agent.sections.role).toContain('agente de eco');
    expect(agent.dir).toBe(join(FIXTURES, 'echo'));
    expect(agent.sourcePath).toBe(join(FIXTURES, 'echo', 'agent.yaml'));
  });

  it('loads an agent with no skills as an empty array', () => {
    expect(loadAgent(FIXTURES, 'reviewer').skills).toEqual([]);
  });

  it('needs a project when agent.yaml uses a project variable', () => {
    expect(loadAgent(FIXTURES, 'with-project').projectRequired).toBe(true);
    expect(loadAgent(FIXTURES, 'with-vars').projectRequired).toBe(false);
  });

  it('needs a project when the text uses a project variable or the agent works on tickets', () => {
    withAgentCopy('echo', (dir) => {
      const yaml = join(dir, 'echo', 'agent.yaml');
      writeFileSync(yaml, readFileSync(yaml, 'utf8').replace('agente de eco', 'agente de eco de ${PROJECT_DIR}'));
      expect(loadAgent(dir, 'echo').projectRequired).toBe(true);
    });
    withAgentCopy('reviewer', (dir) => {
      const yaml = stringify({
        ...head(),
        agent: { id: 'reviewer', name: 'R', version: '1.0.0', description: 'd' },
        ticket_types: ['bug'],
      });
      writeFileSync(join(dir, 'reviewer', 'agent.yaml'), yaml);
      expect(loadAgent(dir, 'reviewer').projectRequired).toBe(true);
    });
  });

  it('refuses an agent that uses a ticket variable but declares no ticket_types, saying why', () => {
    withAgentCopy('with-project', (dir) => {
      const yaml = join(dir, 'with-project', 'agent.yaml');
      writeFileSync(yaml, readFileSync(yaml, 'utf8').replace('${PROJECT_DIR}/tickets/', '${TICKET_FILE}'));

      expect(() => loadAgent(dir, 'with-project')).toThrow(
        /agent "with-project" usa \$\{TICKET\} ou \$\{TICKET_FILE\}, mas não declara ticket_types/,
      );
      writeFileSync(yaml, `${readFileSync(yaml, 'utf8')}ticket_types: [bug]\n`);
      expect(loadAgent(dir, 'with-project')).toMatchObject({ ticketTypes: ['bug'] });
    });
  });

  it('rejects an invalid name before touching the filesystem', () => {
    expect(() => loadAgent(FIXTURES, '../etc')).toThrow(/invalid agent name/);
  });

  it('reports a missing agent directory', () => {
    expect(() => loadAgent(FIXTURES, 'does-not-exist')).toThrow(/not found/);
  });

  it('reports which keys are missing, naming the file', () => {
    expect(() => loadAgent(FIXTURES, 'broken')).toThrow(/broken\/agent\.yaml: .*'models'/);
  });

  it('reports the sections an agent.yaml lacks', () => {
    expect(() => loadAgent(FIXTURES, 'missing-sections')).toThrow(/missing-sections\/agent\.yaml: .*'role'/);
  });

  it('rejects an agent whose agent.yaml has a key the standard does not allow', () => {
    expect(() => loadAgent(FIXTURES, 'schema-invalid-yaml')).toThrow(/"bogus_field"/);
  });
});

describe('listAgents', () => {
  it('lists every well-formed agent, sorted, skipping "_"-prefixed, malformed and non-directory entries', () => {
    const agents = listAgents(FIXTURES);

    expect(agents.map((a) => a.name)).toEqual(['echo', 'reviewer', 'with-prepare', 'with-project', 'with-vars']);
  });

  it('returns an empty list for a directory that does not exist', () => {
    expect(listAgents(join(FIXTURES, 'nope'))).toEqual([]);
  });
});
