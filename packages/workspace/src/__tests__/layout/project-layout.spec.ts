import * as layout from '../../layout/project-layout';

describe('project layout', () => {
  it('names the folders and files of the projects', () => {
    expect(layout).toEqual({
      PROJECTS_SUBDIR: 'projects',
      TICKETS_SUBDIR: 'tickets',
      TESTS_SUBDIR: 'tests',
      TICKET_RUNS_SUBDIR: 'ticket-runs',
      PROJECT_CONFIG_FILE: 'config.json',
      PROJECT_ENV_FILE: '.env.json',
      PROJECT_ENV_EXAMPLE_FILE: '.env.example.json',
    });
  });
});
