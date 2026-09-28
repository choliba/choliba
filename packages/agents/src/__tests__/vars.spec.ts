import { join } from 'node:path';

import { loadAgent } from '../agent-loader';
import { readAgentPermissions } from '../permissions';
import { AgentVarsError, expandVars, pathBase, permissionDirs, withExpandedInstructions } from '../vars';

const FIXTURES = join(__dirname, 'fixtures', 'agents');

describe('expandVars', () => {
  it('replaces each known ${NAME} and lists the unknown ones once', () => {
    expect(expandVars('${A}/x/${B}/${A} ${C} ${C} $A ${lower}', { A: '/a', B: 'b' })).toEqual({
      text: '/a/x/b//a ${C} ${C} $A ${lower}',
      missing: ['C'],
    });
  });
});

describe('withExpandedInstructions', () => {
  it('leaves an agent without variables untouched, never loading them', async () => {
    const agent = await loadAgent(FIXTURES, 'echo');
    const loadVars = jest.fn(() => ({}));

    expect(withExpandedInstructions(agent, loadVars)).toBe(agent);
    expect(loadVars).not.toHaveBeenCalled();
  });

  it('fills in the variables of the permissions, and can do so more than once', async () => {
    const agent = await loadAgent(FIXTURES, 'with-vars');

    for (const root of ['/p1', '/p2']) {
      const expanded = withExpandedInstructions(agent, () => ({ PROJECTS_DIR: root }));
      expect(expanded.permissions.allowWrite).toEqual([`${root}/*/tickets/`]);
      expect(expanded.permissions.allowRead).toEqual([`${root}/*/config.json`]);
    }
  });

  it('fills in the directories and commands of execute too', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const agent = {
      ...echo,
      permissions: readAgentPermissions({ allow: { execute: { '${CHOL_ROOT}/': ['bunx choliba tests ${PROJECT}'] } } }),
    };

    const expanded = withExpandedInstructions(agent, () => ({ CHOL_ROOT: '/w', PROJECT: 'demo' }));

    expect(expanded.permissions.allowExecute).toEqual([{ dir: '/w/', commands: ['bunx choliba tests demo'] }]);
  });

  it('stops naming the file, the missing variables and the available ones', async () => {
    const agent = await loadAgent(FIXTURES, 'with-vars');
    const onlyYaml = { ...agent, instructions: 'sem variáveis' };

    expect(() => withExpandedInstructions(agent, () => ({ GLOBAL_DIR: '/g' }))).toThrow(AgentVarsError);
    expect(() => withExpandedInstructions(agent, () => ({ GLOBAL_DIR: '/g' }))).toThrow(
      `${agent.systemPromptPath} usa \${PROJECTS_DIR}, sem valor (disponíveis: GLOBAL_DIR).`,
    );
    expect(() => withExpandedInstructions(onlyYaml, () => ({ GLOBAL_DIR: '/g' }))).toThrow(
      `${join(agent.dir, 'agent.yaml')} usa \${PROJECTS_DIR}, sem valor (disponíveis: GLOBAL_DIR).`,
    );
  });
});

describe('withExpandedInstructions — steps', () => {
  it('fills in the variables in the arguments of before_execute and after_execute too', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const agent = {
      ...echo,
      beforeExecute: [{ action: 'add_files', args: ['falhas', '.cache/${TICKET}.md'] }],
      afterExecute: [{ action: 'run', args: ['bunx', 'choliba', 'tests', '${PROJECT}:${TICKET}'] }],
    };

    const expanded = withExpandedInstructions(agent, () => ({ PROJECT: 'demo', TICKET: 'demo-2' }));

    expect(expanded.beforeExecute).toEqual([{ action: 'add_files', args: ['falhas', '.cache/demo-2.md'] }]);
    expect(expanded.afterExecute).toEqual([{ action: 'run', args: ['bunx', 'choliba', 'tests', 'demo:demo-2'] }]);
    expect(expanded.instructions).toBe(echo.instructions);
  });

  it('stops naming agent.yaml when a step uses a variable with no value', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const agent = { ...echo, afterExecute: [{ action: 'run', args: ['echo', '${TICKET}'] }] };

    expect(() => withExpandedInstructions(agent, () => ({ PROJECT: 'demo' }))).toThrow(
      `${join(echo.dir, 'agent.yaml')} usa \${TICKET}, sem valor (disponíveis: PROJECT).`,
    );
  });
});

describe('pathBase', () => {
  it('is the part before the first glob segment, or the folder of a plain path', () => {
    expect(pathBase('/p/*/tickets/')).toBe('/p');
    expect(pathBase('/p/demo/tickets/')).toBe('/p/demo/tickets');
    expect(pathBase('/p/demo/config.json')).toBe('/p/demo');
    expect(pathBase('/*.md')).toBe('/');
    expect(pathBase('/')).toBe('/');
  });
});

describe('permissionDirs', () => {
  it('lists the absolute read and write bases once, ignoring relative paths', () => {
    expect(
      permissionDirs(
        readAgentPermissions({
          allow: {
            read: ['/p/*/config.json', 'docs/'],
            write: ['/p/*/tickets/'],
            execute: { '/app/': ['composer test'], './': ['a'], '/p/': ['b'] },
          },
          deny: { read: ['/secret/'] },
        }),
      ),
    ).toEqual(['/p', '/app']);
  });
});
