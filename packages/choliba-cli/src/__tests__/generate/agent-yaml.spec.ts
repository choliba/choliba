import { parseAgentYaml } from '@choliba/agents';

import { ACCESS } from '../../generate/agent-options';
import { agentYaml, type AgentSpec } from '../../generate/agent-yaml';

const SPEC: AgentSpec = {
  name: 'revisor-de-pr',
  description: 'Revisa o código: "com aspas" e: dois pontos',
  role: 'Você revisa código.',
  models: ['claude-sonnet-5', 'Auto'],
  project: true,
  access: 'testes',
};

describe('agentYaml', () => {
  it('is valid for the choliba with every access, on a project or not', () => {
    for (const access of ACCESS) {
      for (const project of [true, false]) {
        const text = agentYaml({ ...SPEC, project, access: project ? access : 'nada' });
        expect(() => parseAgentYaml(text, 'agent.yaml', SPEC.name)).not.toThrow();
      }
    }
  });

  it('keeps the answers as written, and gives each access its permissions', () => {
    const parsed = parseAgentYaml(agentYaml(SPEC), 'agent.yaml', SPEC.name);
    expect(parsed.description).toBe(SPEC.description);
    expect(parsed.supportedModels).toEqual(SPEC.models);

    const text = agentYaml(SPEC);
    expect(text).toContain('Revisor De Pr');
    expect(text).toContain('CHANGE_ME');
    expect(text).toContain("'bunx choliba tests ${PROJECT}/tests'");
    expect(agentYaml({ ...SPEC, access: 'escrita' })).not.toContain('execute:');
    expect(agentYaml({ ...SPEC, access: 'leitura' })).not.toContain('write:');
    expect(agentYaml({ ...SPEC, project: false, access: 'nada' })).not.toContain('permissions:');
  });
});
