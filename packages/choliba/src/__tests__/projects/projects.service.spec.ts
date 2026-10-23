import fs from 'node:fs';
import { join } from 'node:path';

import { envSource } from '@choliba/config';
import { projectsConfig } from '@choliba/workspace';

import { LocationsService, ProjectsService } from '../../projects';
import { makeTmpDir } from '../helpers/tmp';

describe('ProjectsService', () => {
  it('serves project data through the app-owned service and its shipped templates', () => {
    const tmp = makeTmpDir('projects-service');
    try {
      const projectsDir = join(tmp.path, 'projects');
      const projectDir = join(projectsDir, 'red');
      const ticketsDir = join(projectDir, 'tickets');
      fs.mkdirSync(ticketsDir, { recursive: true });
      fs.writeFileSync(
        join(projectDir, 'config.json'),
        JSON.stringify({
          name: 'red',
          description: 'Projeto vermelho',
          envs: [{ nome: 'qa', baseURL: 'http://localhost:3000', appDir: '.' }],
        }),
      );
      fs.writeFileSync(join(projectDir, '.env.json'), JSON.stringify({ qa: {} }));
      fs.writeFileSync(
        join(ticketsDir, '1.json'),
        JSON.stringify({ ticket: 'red-1', tipo: 'bug', titulo: 'Falha', criterios: [] }),
      );
      const locations = new LocationsService(
        projectsConfig.read([envSource({ CHOL_GLOBAL_DIR: tmp.path, CHOL_PROJECTS_DIR: projectsDir })]),
      );
      const service = new ProjectsService(locations);

      expect(service.projectsDir()).toBe(projectsDir);
      expect(service.list()).toEqual([{ name: 'red', description: 'Projeto vermelho' }]);
      expect(service.listWithTickets()).toEqual([{ name: 'red', tickets: ['red-1'] }]);
      expect(service.tickets('red').map((ticket) => ticket.id)).toEqual(['red-1']);
      expect(service.ticketKeys('red')).toEqual(['red-1']);
      expect(service.check('red').environment.nome).toBe('qa');

      const appDir = join(tmp.path, 'apps', 'blue');
      fs.mkdirSync(appDir, { recursive: true });
      const created = service.create({
        name: 'blue',
        appDir,
        baseUrl: 'http://localhost:4000',
      });
      expect(created.dir).toBe(join(projectsDir, 'blue'));
      expect(fs.existsSync(join(created.dir, 'config.json'))).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  it('leaves the description empty when a project config cannot be read', () => {
    const tmp = makeTmpDir('projects-service-invalid');
    try {
      const projectsDir = join(tmp.path, 'projects');
      const projectDir = join(projectsDir, 'broken');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(join(projectDir, 'config.json'), '{');
      const locations = new LocationsService(
        projectsConfig.read([envSource({ CHOL_GLOBAL_DIR: tmp.path, CHOL_PROJECTS_DIR: projectsDir })]),
      );

      expect(new ProjectsService(locations).list()).toEqual([{ name: 'broken', description: '' }]);
    } finally {
      tmp.cleanup();
    }
  });
});
