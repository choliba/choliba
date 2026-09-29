import * as config from '../../config/index';

describe('config barrel exports', () => {
  it('re-exports config var names and repo config helpers', () => {
    expect(config.CHOL_AGENTS_PROVIDER).toBe('CHOL_AGENTS_PROVIDER');
    expect(config.CHOL_AGENTS_DIR).toBe('CHOL_AGENTS_DIR');
    expect(config.CHOL_SKILLS_DIR).toBe('CHOL_SKILLS_DIR');
    expect(config.CHOL_MCPS_DIR).toBe('CHOL_MCPS_DIR');
    expect(config.PACKAGE_NAME).toBe('choliba');
    expect(config.CHOL_GLOBAL_DIR).toBe('CHOL_GLOBAL_DIR');
    expect(config.PROJECTS_DIR).toBe('PROJECTS_DIR');
    expect(config.PROJECTS_SUBDIR).toBe('projects');
    expect(config.TICKET_RUNS).toBe('TICKET_RUNS');
    expect(config.parseConfigFile('FOO=bar')).toEqual({ FOO: 'bar' });
    expect(config.mergeConfig({ FOO: 'file' }, { FOO: 'shell' })).toEqual({ FOO: 'shell' });
    expect(config.loadRepoConfig('/missing', { FOO: 'bar' }, () => undefined)).toEqual({ FOO: 'bar' });
  });

  it('re-exports the one source of the workspace layout and of the file names choliba loads', () => {
    expect([config.APP_DIR, config.AGENTS_SUBDIR, config.SKILLS_SUBDIR, config.MCPS_SUBDIR]).toEqual([
      'app',
      'agents',
      '.agents/skills',
      '.agents/mcps',
    ]);
    expect([config.TICKETS_SUBDIR, config.TESTS_SUBDIR, config.TICKET_RUNS_SUBDIR]).toEqual([
      'tickets',
      'tests',
      'ticket-runs',
    ]);
    expect([config.CACHE_DIR, config.RUNS_DIR, config.ARTIFACTS_DIR]).toEqual([
      '.cache',
      '.cache/runs',
      '.cache/choliba',
    ]);
    expect([config.AGENT_FILE, config.SYSTEM_FILE, config.SKILL_FILE, config.ENV_FILE, config.PACKAGE_FILE]).toEqual([
      'agent.yaml',
      'system.md',
      'SKILL.md',
      '.env',
      'package.json',
    ]);
    expect([
      config.ENV_EXAMPLE_FILE,
      config.GITIGNORE_FILE,
      config.BUNFIG_FILE,
      config.PRETTIERRC_FILE,
      config.PRETTIERIGNORE_FILE,
      config.ESLINT_CONFIG_FILE,
    ]).toEqual([
      '.env.example',
      '.gitignore',
      'bunfig.toml',
      '.prettierrc.json',
      '.prettierignore',
      'eslint.config.mjs',
    ]);
    expect([config.PROJECT_CONFIG_FILE, config.PROJECT_ENV_FILE, config.PROJECT_ENV_EXAMPLE_FILE]).toEqual([
      'config.json',
      '.env.json',
      '.env.example.json',
    ]);
  });
});
