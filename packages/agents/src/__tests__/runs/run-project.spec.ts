import type { AgentDefinition } from '../../agents/interfaces/agent.interface';
import { NO_PERMISSIONS, readAgentPermissions } from '../../runs/permissions';
import { formatProject, withProjectDenies } from '../../runs/run-project';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';

function fakeAgent(permissions: AgentDefinition['permissions']): AgentDefinition {
  return {
    name: 'echo',
    id: 'echo',
    displayName: 'Echo',
    version: '1.0.0',
    description: 'repeats things',
    supportedModels: [],
    skills: [],
    mcps: [],
    policy: 'edits',
    taskRequired: true,
    projectRequired: true,
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute'],
    permissions,
    dir: '/w/agents/echo',
    sections: fakeSections('be an echo'),
    steps: NO_MODE_STEPS,
    sourcePath: '/w/agents/echo/agent.yaml',
  };
}

const PROJECT = { name: 'site', baseURL: 'http://localhost:3000', appDir: '/code/site/' };

describe('formatProject', () => {
  it('names the application and says the agent never starts, fakes or patches it', () => {
    const block = formatProject({ ...PROJECT, name: 'a "b"' });

    expect(block.split('\n')[0]).toBe(
      '<project name="a &quot;b&quot;" baseURL="http://localhost:3000" appDir="/code/site/">',
    );
    expect(block).toContain('made sure\nit is up before this run');
    expect(block).toContain('Never start, stop or\nrestart it yourself');
    expect(block).toContain('never write a server, boot script or mock of it');
    expect(block).toContain('stop and report the message');
    expect(block.endsWith('</project>')).toBe(true);
  });

  it('is empty without a project', () => {
    expect(formatProject(undefined)).toBe('');
  });
});

describe('withProjectDenies', () => {
  it("denies writing and deleting the application's node_modules, keeping what the agent declares", () => {
    const agent = fakeAgent(readAgentPermissions({ deny: { write: ['packages/'] } }));

    const { permissions } = withProjectDenies(agent, PROJECT);

    expect(permissions.denyWrite).toEqual(['packages/', '/code/site/node_modules/']);
    expect(permissions.denyDelete).toEqual(['/code/site/node_modules/']);
  });

  it('leaves the agent as it is without a project', () => {
    const agent = fakeAgent(NO_PERMISSIONS);

    expect(withProjectDenies(agent, undefined)).toBe(agent);
  });
});
