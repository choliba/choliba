import * as config from '../../config/index';

describe('config barrel exports', () => {
  it('re-exports config var names and repo config helpers', () => {
    expect(config.CHOL_AGENTS_PROVIDER).toBe('CHOL_AGENTS_PROVIDER');
    expect(config.CHOL_AGENTS_DIR).toBe('CHOL_AGENTS_DIR');
    expect(config.CHOL_SKILLS_DIR).toBe('CHOL_SKILLS_DIR');
    expect(config.CHOL_MCPS_DIR).toBe('CHOL_MCPS_DIR');
    expect(config.PACKAGE_NAME).toBe('choliba');
    expect(config.GLOBAL_DIR).toBe('GLOBAL_DIR');
    expect(config.PROJECTS_DIR).toBe('PROJECTS_DIR');
    expect(config.PROJECTS_SUBDIR).toBe('projects');
    expect(config.TICKET_RUNS).toBe('TICKET_RUNS');
    expect(config.parseConfigFile('FOO=bar')).toEqual({ FOO: 'bar' });
    expect(config.mergeConfig({ FOO: 'file' }, { FOO: 'shell' })).toEqual({ FOO: 'shell' });
    expect(config.loadRepoConfig('/missing', { FOO: 'bar' }, () => undefined)).toEqual({ FOO: 'bar' });
  });
});
