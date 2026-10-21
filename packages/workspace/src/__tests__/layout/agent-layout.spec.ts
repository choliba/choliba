import * as layout from '../../layout/agent-layout';

describe('agent layout', () => {
  it('names the agents folders and files of a workspace', () => {
    expect(layout).toEqual({
      CHOLIBA_DIR: '.choliba',
      AGENTS_SUBDIR: 'agents',
      SKILLS_SUBDIR: 'skills',
      MCPS_SUBDIR: 'mcps',
      DEFAULT_AGENTS_DIR: '.choliba/agents',
      DEFAULT_SKILLS_DIR: '.choliba/skills',
      DEFAULT_MCPS_DIR: '.choliba/mcps',
      CACHE_DIR: '.cache',
      RUNS_DIR: '.cache/runs',
      AGENT_FILE: 'agent.yaml',
      SKILL_FILE: 'SKILL.md',
    });
  });
});
