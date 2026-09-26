import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AgentConfigError,
  isValidAgentName,
  listAgents,
  loadAgent,
  parseAgentYaml,
  policyFromPermissions,
} from '../agent-loader';
import { makeTmpDir } from './helpers/tmp';

const FIXTURES = join(__dirname, 'fixtures/agents');

describe('isValidAgentName', () => {
  it('accepts lowercase names with digits, dash and underscore', () => {
    expect(isValidAgentName('developer')).toBe(true);
    expect(isValidAgentName('red-developer')).toBe(true);
    expect(isValidAgentName('agent_2')).toBe(true);
  });

  it('rejects path traversal and empty names', () => {
    expect(isValidAgentName('..')).toBe(false);
    expect(isValidAgentName('../etc')).toBe(false);
    expect(isValidAgentName('a/b')).toBe(false);
    expect(isValidAgentName('')).toBe(false);
    expect(isValidAgentName('Developer')).toBe(false);
  });
});

describe('parseAgentYaml', () => {
  it('parses every field, including skills and mcps', () => {
    const text = [
      'id: x-agent',
      'name: X Agent',
      'version: 1.0.0',
      'description: "does x"',
      'supported_models:',
      '  - claude-3-5-sonnet',
      'skills:',
      '  - one',
      '  - two',
      'mcps:',
      '  - browser',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml')).toEqual({
      id: 'x-agent',
      displayName: 'X Agent',
      version: '1.0.0',
      description: 'does x',
      supportedModels: ['claude-3-5-sonnet'],
      skills: ['one', 'two'],
      mcps: [{ name: 'browser' }],
      taskRequired: true,
      projectRequired: false,
      defaultMode: 'execute',
    });
  });

  it('defaults skills and mcps to an empty array when absent', () => {
    const text = ['id: x', 'name: X', 'version: 1.0.0', 'description: d', 'supported_models: []'].join('\n');

    expect(parseAgentYaml(text, 'x.yaml').skills).toEqual([]);
    expect(parseAgentYaml(text, 'x.yaml').mcps).toEqual([]);
  });

  it('rejects invalid YAML', () => {
    expect(() => parseAgentYaml(':\n  - not: valid: yaml', 'x.yaml')).toThrow(AgentConfigError);
  });

  it('rejects a YAML document that is not a mapping', () => {
    expect(() => parseAgentYaml('- a\n- b', 'x.yaml')).toThrow(/must be a YAML mapping/);
  });

  it.each([
    ['id', 'name: X\nversion: 1.0.0\ndescription: d\nsupported_models: []'],
    ['name', 'id: x\nversion: 1.0.0\ndescription: d\nsupported_models: []'],
    ['version', 'id: x\nname: X\ndescription: d\nsupported_models: []'],
    ['description', 'id: x\nname: X\nversion: 1.0.0\nsupported_models: []'],
    ['supported_models', 'id: x\nname: X\nversion: 1.0.0\ndescription: d'],
  ])('rejects a missing "%s"', (field, text) => {
    expect(() => parseAgentYaml(text, 'x.yaml')).toThrow(new RegExp(field));
  });

  it('rejects "skills" that is present but not an array of strings', () => {
    const text = 'id: x\nname: X\nversion: 1.0.0\ndescription: d\nsupported_models: []\nskills: nope';

    expect(() => parseAgentYaml(text, 'x.yaml')).toThrow(/"skills" must be an array/);
  });

  it('reads "mcps" as a map, restricting a server to its tools or allowing them all', () => {
    const text = [
      'id: x',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: []',
      'mcps:',
      '  app:',
      '    tools: [jira_search, use_environment]',
      '  browser:',
      '  other: {}',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml').mcps).toEqual([
      { name: 'app', tools: ['jira_search', 'use_environment'] },
      { name: 'browser' },
      { name: 'other' },
    ]);
  });

  it('reads ticket_types, which needs project_required and at least one type', () => {
    const base = 'id: x\nname: X\nversion: 1.0.0\ndescription: d\nsupported_models: []\n';

    expect(parseAgentYaml(`${base}project_required: true\nticket_types: [bug, story]`, 'x.yaml').ticketTypes).toEqual([
      'bug',
      'story',
    ]);
    expect(parseAgentYaml(base, 'x.yaml').ticketTypes).toBeUndefined();
    expect(() => parseAgentYaml(`${base}project_required: true\nticket_types: []`, 'x.yaml')).toThrow(
      /"ticket_types" must be a non-empty array/,
    );
    expect(() => parseAgentYaml(`${base}ticket_types: [bug]`, 'x.yaml')).toThrow(
      /"ticket_types" needs "project_required: true"/,
    );
  });

  it.each([
    ['mcps: [1]', /"mcps" must be an array of strings or a map/],
    ['mcps: nope', /"mcps" must be an array of strings or a map/],
    ['mcps:\n  app:\n    tools: []', /"mcps.app.tools" must be a non-empty array/],
    ['mcps:\n  app:\n    tools: [1]', /"mcps.app.tools" must be a non-empty array/],
    ['mcps:\n  app:\n    tool: [x]', /"mcps.app" only accepts "tools"/],
    ['mcps:\n  app: yes', /"mcps.app" only accepts "tools"/],
  ])('rejects the malformed mcps %j', (mcps, message) => {
    const text = `id: x\nname: X\nversion: 1.0.0\ndescription: d\nsupported_models: []\n${mcps}`;

    expect(() => parseAgentYaml(text, 'x.yaml')).toThrow(message);
  });

  it('parses policy, task_required, project_required, default_mode and prepare/after_execute', () => {
    const text = [
      'id: x-agent',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: [m]',
      'policy: edits',
      'task_required: false',
      'project_required: true',
      'default_mode: plan',
      'prepare:',
      '  kind: working_tree_diff',
      '  diff_file: .cache/x/diff.patch',
      '  since_pending_state: .cache/x/last-base',
      'after_execute:',
      '  - record_git_head .cache/x/last-base',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml')).toMatchObject({
      policy: 'edits',
      taskRequired: false,
      projectRequired: true,
      defaultMode: 'plan',
      defaultTask: 'Atualize a documentação com base no contexto entregue.',
      beforeExecute: [
        { action: 'git_diff', args: ['develop', '.cache/x/diff.patch', '--pending', '.cache/x/last-base'] },
        { action: 'add_files', args: ['documentacao_atual', 'docs/**/*.md'] },
        { action: 'add_files', args: ['readme_atual', 'README.md'] },
      ],
      afterExecute: [{ action: 'record_git_head', args: ['.cache/x/last-base'] }],
    });
  });

  it('parses default_task, before_execute and after_execute as <action>: [args]', () => {
    const text = [
      'id: x',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: [m]',
      'default_task: t',
      'before_execute:',
      '  - git_diff: [develop, d.patch]',
      '  - run: [bun, run, build]',
      'after_execute:',
      '  - run: [bun, x, prettier]',
      '  - record_git_head: [s]',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml')).toMatchObject({
      defaultTask: 't',
      beforeExecute: [
        { action: 'git_diff', args: ['develop', 'd.patch'] },
        { action: 'run', args: ['bun', 'run', 'build'] },
      ],
      afterExecute: [
        { action: 'run', args: ['bun', 'x', 'prettier'] },
        { action: 'record_git_head', args: ['s'] },
      ],
    });
  });

  it('parses after_execute lines as strings or lists, in order', () => {
    const text = [
      'id: x',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: [m]',
      'after_execute:',
      '  - "  bun x prettier --write docs README.md  "',
      '  - [record_git_head, s]',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml').afterExecute).toEqual([
      { action: 'run', args: ['sh', '-c', 'bun x prettier --write docs README.md'] },
      { action: 'record_git_head', args: ['s'] },
    ]);
  });

  it('rejects an unsupported prepare kind', () => {
    const text = [
      'id: x',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: [m]',
      'prepare:',
      '  kind: unknown_kind',
      '  diff_file: .cache/x/diff.patch',
      '  since_pending_state: .cache/x/last-base',
    ].join('\n');

    expect(() => parseAgentYaml(text, 'x.yaml')).toThrow(/prepare\.kind/);
  });

  it.each([
    ['policy', 'policy: bogus', /invalid "policy"/],
    ['default_mode', 'default_mode: bogus', /invalid "default_mode"/],
    ['task_required', 'task_required: maybe', /"task_required" must be a boolean/],
    ['project_required', 'project_required: maybe', /"project_required" must be a boolean/],
    ['prepare mapping', 'prepare: not-a-map', /"prepare" must be a mapping/],
    ['prepare.diff_file', 'prepare:\n  kind: working_tree_diff\n  since_pending_state: s', /prepare\.diff_file/],
    [
      'prepare.since_pending_state',
      'prepare:\n  kind: working_tree_diff\n  diff_file: d',
      /prepare\.since_pending_state/,
    ],
    ['prepare.snapshot', 'prepare:\n  kind: working_tree_diff\n  diff_file: d\n  since_pending_state: s\n  snapshot: nope', /prepare\.snapshot/],
    [
      'prepare.snapshot.docs',
      'prepare:\n  kind: working_tree_diff\n  diff_file: d\n  since_pending_state: s\n  snapshot:\n    docs: nope',
      /prepare\.snapshot\.docs/,
    ],
    [
      'prepare.snapshot.readme',
      'prepare:\n  kind: working_tree_diff\n  diff_file: d\n  since_pending_state: s\n  snapshot:\n    readme: nope',
      /prepare\.snapshot\.readme/,
    ],
    ['after_execute list', 'after_execute: nope', /"after_execute" must be a list/],
    ['after_execute mapping', 'after_execute:\n  kind: record_git_head', /"after_execute" must be a list/],
    ['after_execute unknown action', 'after_execute:\n  - { kind: [x] }', /ação desconhecida "kind"/],
    ['after_execute non-list args', 'after_execute:\n  - { run: x }', /"<action>: \[args\]"/],
    ['after_execute two keys', 'after_execute:\n  - { run: [a], record_git_head: [b] }', /"<action>: \[args\]"/],
    ['after_execute no key', 'after_execute:\n  - {}', /"<action>: \[args\]"/],
    ['after_execute wrong list', 'after_execute:\n  - git_diff: [a, b]', /não pode ser usado em after_execute/],
    ['before_execute list', 'before_execute: nope', /"before_execute" must be a list/],
    ['before_execute args', 'before_execute:\n  - add_files: [tag]', /esperado "add_files <tag> <glob...>"/],
    ['default_task', 'default_task: 3', /"default_task" must be a string/],
    [
      'prepare with before_execute',
      'prepare:\n  kind: working_tree_diff\n  diff_file: d\n  since_pending_state: s\nbefore_execute:\n  - run: [x]',
      /not both/,
    ],
    ['after_execute blank line', 'after_execute:\n  - "   "', /non-empty string or a non-empty list/],
    ['after_execute empty list', 'after_execute:\n  - []', /non-empty string or a non-empty list/],
    ['after_execute method arity', 'after_execute:\n  - record_git_head', /esperado "record_git_head <arquivo>"/],
    ['after_execute method extra', 'after_execute:\n  - [record_git_head, a, b]', /esperado "record_git_head/],
  ])('rejects invalid %s', (_label, extra, pattern) => {
    const base = ['id: x', 'name: X', 'version: 1.0.0', 'description: d', 'supported_models: [m]', extra].join('\n');
    expect(() => parseAgentYaml(base, 'x.yaml')).toThrow(pattern);
  });

  it('defaults readme to true when snapshot omits the readme key', () => {
    const text = [
      'id: x',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: [m]',
      'prepare:',
      '  kind: working_tree_diff',
      '  diff_file: .cache/x/diff.patch',
      '  since_pending_state: .cache/x/last-base',
      '  snapshot:',
      '    docs: false',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml').beforeExecute?.map((step) => step.args[0])).toEqual([
      'develop',
      'readme_atual',
    ]);
  });

  it('turns off the readme add_files when snapshot.readme is false', () => {
    const text = [
      'id: x',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: [m]',
      'prepare:',
      '  kind: working_tree_diff',
      '  diff_file: d',
      '  since_pending_state: s',
      '  snapshot:',
      '    readme: false',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml').beforeExecute?.map((step) => step.args[0])).toEqual([
      'develop',
      'documentacao_atual',
    ]);
  });

  it('honors custom default_base, default_task and partial snapshot flags', () => {
    const text = [
      'id: x',
      'name: X',
      'version: 1.0.0',
      'description: d',
      'supported_models: [m]',
      'prepare:',
      '  kind: working_tree_diff',
      '  diff_file: .cache/x/diff.patch',
      '  since_pending_state: .cache/x/last-base',
      '  default_base: main',
      '  default_task: custom task',
      '  snapshot:',
      '    docs: false',
      '    readme: true',
    ].join('\n');

    expect(parseAgentYaml(text, 'x.yaml')).toMatchObject({
      defaultTask: 'custom task',
      beforeExecute: [
        { action: 'git_diff', args: ['main', '.cache/x/diff.patch', '--pending', '.cache/x/last-base'] },
        { action: 'add_files', args: ['readme_atual', 'README.md'] },
      ],
    });
  });
});

describe('policyFromPermissions', () => {
  it('is edits with a write path and read-only otherwise', () => {
    expect(policyFromPermissions('<permissions><allow action="write"><path>docs/</path></allow></permissions>')).toBe(
      'edits',
    );
    expect(policyFromPermissions('<permissions><allow action="read"><tool>Read</tool></allow></permissions>')).toBe(
      'read-only',
    );
  });
});

describe('loadAgent', () => {
  it('loads an agent with skills', async () => {
    const agent = await loadAgent(FIXTURES, 'echo');

    expect(agent).toMatchObject({
      name: 'echo',
      id: 'example-echo-agent',
      displayName: 'Echo Agent',
      version: '1.0.0',
      skills: ['dummy-skill'],
    });
    expect(agent.instructions).toContain('agente de eco');
    expect(agent.dir).toBe(join(FIXTURES, 'echo'));
  });

  it('derives the policy from system.md when agent.yaml has none', async () => {
    const tmp = makeTmpDir('loader-policy');
    try {
      cpSync(join(FIXTURES, 'echo'), join(tmp.path, 'echo'), { recursive: true });
      const yamlPath = join(tmp.path, 'echo', 'agent.yaml');
      writeFileSync(yamlPath, readFileSync(yamlPath, 'utf8').replace('policy: read-only\n', ''));

      expect((await loadAgent(tmp.path, 'echo')).policy).toBe('edits');
    } finally {
      tmp.cleanup();
    }
  });

  it('loads an agent with no skills as an empty array', async () => {
    expect((await loadAgent(FIXTURES, 'reviewer')).skills).toEqual([]);
  });

  it('rejects an invalid name before touching the filesystem', async () => {
    await expect(loadAgent(FIXTURES, '../etc')).rejects.toThrow(/invalid agent name/);
  });

  it('reports a missing agent directory', async () => {
    await expect(loadAgent(FIXTURES, 'does-not-exist')).rejects.toThrow(/not found/);
  });

  it('reports which YAML field is missing, naming the file', async () => {
    await expect(loadAgent(FIXTURES, 'broken')).rejects.toThrow(/agent\.yaml.*description/);
  });

  it('reports a missing system.md, distinct from a missing agent.yaml', async () => {
    await expect(loadAgent(FIXTURES, 'no-system-md')).rejects.toThrow(/system\.md/);
  });

  // Schema validation (agent.yaml against agent.schema.json, system.md against agent.xsd) is
  // exercised in depth in agent-validation.spec.ts / commands/agent.spec.ts — this just proves
  // loadAgent actually wires it in and fails for real when either file breaks the schema.
  it('rejects an agent whose agent.yaml has a field the schema does not allow', async () => {
    await expect(loadAgent(FIXTURES, 'schema-invalid-yaml')).rejects.toThrow(/failed schema validation/);
  });

  it('rejects an agent whose system.md is not valid per the XSD', async () => {
    await expect(loadAgent(FIXTURES, 'schema-invalid-xml')).rejects.toThrow(/failed schema validation/);
  });
});

describe('phases', () => {
  const HEAD = [
    'id: x',
    'name: X',
    'version: 1.0.0',
    'description: d',
    'supported_models: [m]',
    'project_required: true',
  ].join('\n');
  const parse = (body: string) => parseAgentYaml(`${HEAD}\n${body}\n`, 'agent.yaml');

  it('reads each phase in order, with its system file, description, switch and steps', () => {
    const fields = parse(
      [
        'phases:',
        '  red:',
        '    system: red.md',
        '    after_execute:',
        '      - run: [echo, a]',
        '  green:',
        '    system: green.md',
        '    description: Implementa.',
        '    project_switch: greenHabilitado',
        '    before_execute:',
        '      - add_files: [falhas, x.md]',
      ].join('\n'),
    );

    expect(fields.phases).toEqual([
      { name: 'red', system: 'red.md', afterExecute: [{ action: 'run', args: ['echo', 'a'] }] },
      {
        name: 'green',
        system: 'green.md',
        description: 'Implementa.',
        projectSwitch: 'greenHabilitado',
        beforeExecute: [{ action: 'add_files', args: ['falhas', 'x.md'] }],
      },
    ]);
  });

  it.each([
    ['phases: []', /"phases" must be a non-empty mapping/],
    ['phases: {}', /"phases" must be a non-empty mapping/],
    ['phases:\n  red: {}', /"phases.red.system"/],
    ['phases:\n  red:\n    system: ../x.md', /"phases.red.system"/],
    ['phases:\n  Red:\n    system: r.md', /invalid phase name "Red"/],
    ['phases:\n  mode:\n    system: r.md', /phase "mode" would clash with the flag --mode/],
    ['phases:\n  cursor:\n    system: r.md', /phase "cursor" would clash with the flag --cursor/],
    ['phases:\n  red:\n    system: r.md\n    project_switch: 3', /"phases.red.project_switch"/],
    ['phases:\n  red:\n    system: r.md\n    description: [x]', /"phases.red.description"/],
    ['phases:\n  red:\n    system: r.md\n    after_execute: [{ git_diff: [a, b] }]', /"after_execute"/],
    ['phases:\n  red: x', /"phases.red" must be a mapping/],
    ['phases:\n  red:\n    system: r.md\nbefore_execute:\n  - run: [a]', /"before_execute".*inside each phase/],
  ])('rejects %j', (body, error) => {
    expect(() => parse(body)).toThrow(error);
  });

  it('needs project_required for a phase with a project_switch', () => {
    const yaml = [HEAD.replace('project_required: true', ''), 'phases:', '  red:', '    system: r.md', '    project_switch: s'];
    expect(() => parseAgentYaml(`${yaml.join('\n')}\n`, 'agent.yaml')).toThrow(/project_switch.*project_required/);
  });

  it('loads each phase from its own system file, with no system.md, the first one standing for the agent', async () => {
    const agent = await loadAgent(FIXTURES, 'with-phases');

    expect(agent.phases?.map((phase) => [phase.name, phase.policy, phase.systemPromptPath])).toEqual([
      ['red', 'edits', join(FIXTURES, 'with-phases', 'red.md')],
      ['green', 'edits', join(FIXTURES, 'with-phases', 'green.md')],
    ]);
    expect(agent.phases?.[1]?.instructions).toContain('fase green');
    expect(agent.systemPromptPath).toBe(join(FIXTURES, 'with-phases', 'red.md'));
    expect(agent.instructions).toContain('fase red');
  });

  it('reports a missing phase file and a phase file that breaks the schema', async () => {
    const tmp = makeTmpDir('loader-phases');
    try {
      cpSync(join(FIXTURES, 'with-phases'), join(tmp.path, 'with-phases'), { recursive: true });
      writeFileSync(join(tmp.path, 'with-phases', 'green.md'), '<agent><nope/></agent>');
      await expect(loadAgent(tmp.path, 'with-phases')).rejects.toThrow(/green\.md.*schema/s);

      rmSync(join(tmp.path, 'with-phases', 'green.md'));
      await expect(loadAgent(tmp.path, 'with-phases')).rejects.toThrow(/missing .*green\.md/);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('listAgents', () => {
  it('lists every well-formed agent, sorted, skipping "_"-prefixed, malformed and non-directory entries', async () => {
    const agents = await listAgents(FIXTURES);

    expect(agents.map((a) => a.name)).toEqual([
      'echo',
      'reviewer',
      'with-phases',
      'with-prepare',
      'with-project',
      'with-vars',
    ]);
  });

  it('returns an empty list for a directory that does not exist', async () => {
    expect(await listAgents(join(FIXTURES, 'nope'))).toEqual([]);
  });
});
