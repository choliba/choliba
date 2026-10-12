import { NO_PERMISSIONS } from '../../common/agent-permissions';
import { definitionExceptionProblems, withDefinitionDenies } from '../../common/definition-denies';
import type { AgentDefinition } from '../../common/interfaces/agent.interface';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';

const DIRS = ['/w/.choliba/agents', '/w/.choliba/skills/', '/w/.choliba/mcps'];
const FOLDERS = ['/w/.choliba/agents/', '/w/.choliba/skills/', '/w/.choliba/mcps/'];

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
    projectRequired: false,
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute'],
    permissions,
    dir: '/w/.choliba/agents/echo',
    sections: fakeSections('be an echo'),
    steps: NO_MODE_STEPS,
    sourcePath: '/w/.choliba/agents/echo/agent.yaml',
  };
}

describe('withDefinitionDenies', () => {
  it('adds the agent, skill and mcp folders to deny.write and deny.delete', () => {
    const agent = withDefinitionDenies(fakeAgent({ ...NO_PERMISSIONS, allowWrite: ['/w/'] }), DIRS);

    expect(agent.permissions.allowWrite).toEqual(['/w/']);
    for (const folder of FOLDERS) {
      expect(agent.permissions.denyWrite).toContain(folder);
      expect(agent.permissions.denyDelete).toContain(folder);
    }
  });
});

describe('definitionExceptionProblems', () => {
  it('names a write or delete exception that is a definition folder or lies inside one', () => {
    const permissions = {
      ...NO_PERMISSIONS,
      denyWrite: ['/w/.choliba/agents/', '!/w/.choliba/agents/x/'],
      denyDelete: ['/w/.choliba/skills/', '!/w/.choliba/skills'],
      denyRead: ['/w/.choliba/skills/', '!/w/.choliba/skills/dummy/'],
    };

    expect(definitionExceptionProblems(permissions, DIRS)).toEqual([
      '  deny.write: !/w/.choliba/agents/x reabre uma definição do choliba, que nenhuma run altera',
      '  deny.delete: !/w/.choliba/skills reabre uma definição do choliba, que nenhuma run altera',
    ]);
  });

  it('leaves a read exception, and a write exception outside the definition folders', () => {
    const permissions = {
      ...NO_PERMISSIONS,
      denyWrite: ['/w/', '!/w/docs/'],
      denyRead: ['/w/.choliba/agents/', '!/w/.choliba/agents/echo/'],
    };

    expect(definitionExceptionProblems(permissions, DIRS)).toEqual([]);
  });
});
