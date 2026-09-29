import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ProjectsError,
  createTicket,
  describeTicketTypes,
  listTicketTypes,
  nextTicketSuffix,
  planTicket,
  ticketPlaceholders,
  ticketTemplatesDir,
  projectTemplatesDir,
  runProjectsCli,
} from '../index';

function comDiretorio<T>(prefixo: string, fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Um projeto mínimo (config.json + .env.json) com os tickets `sufixos`. */
function comProjeto(projetosDir: string, projeto: string, sufixos: readonly string[] = []): void {
  const dir = path.join(projetosDir, projeto);
  fs.mkdirSync(path.join(dir, 'tickets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), '{}');
  fs.writeFileSync(path.join(dir, '.env.json'), '{}');
  for (const sufixo of sufixos) fs.writeFileSync(path.join(dir, 'tickets', `${sufixo}.json`), '{}');
}

function lerJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

describe('listTicketTypes', () => {
  it('lists the types this package ships a template for', () => {
    expect(listTicketTypes(ticketTemplatesDir())).toEqual(['bug', 'improvement', 'story', 'task']);
  });

  it('lists only .json files, and nothing for a missing folder', () => {
    comDiretorio('ticket-types-', (dir) => {
      fs.writeFileSync(path.join(dir, 'b.json'), '{}');
      fs.writeFileSync(path.join(dir, 'a.json'), '{}');
      fs.writeFileSync(path.join(dir, 'README.md'), '');
      fs.mkdirSync(path.join(dir, 'c.json'));

      expect(listTicketTypes(dir)).toEqual(['a', 'b']);
      expect(listTicketTypes(path.join(dir, 'nope'))).toEqual([]);
    });
  });
});

describe('package resources', () => {
  it('points at the project template and exposes the CLI', () => {
    expect(fs.existsSync(path.join(projectTemplatesDir(), 'config.json'))).toBe(true);
    expect(typeof runProjectsCli).toBe('function');
  });
});

describe('describeTicketTypes', () => {
  it('says what each shipped type is for', () => {
    const described = describeTicketTypes(ticketTemplatesDir());

    expect(described.map(({ type }) => type)).toEqual(['bug', 'improvement', 'story', 'task']);
    for (const { description } of described) {
      expect(description.length).toBeGreaterThan(10);
    }
  });
});

describe('nextTicketSuffix', () => {
  it('is the highest numeric suffix plus one, ignoring non-numeric ones', () => {
    comDiretorio('ticket-next-', (projetosDir) => {
      comProjeto(projetosDir, 'vazio');
      comProjeto(projetosDir, 'demo', ['1', '9', '10', 'T-99', '2']);

      expect(nextTicketSuffix(projetosDir, 'vazio')).toBe('1');
      expect(nextTicketSuffix(projetosDir, 'demo')).toBe('11');
    });
  });
});

describe('planTicket / createTicket', () => {
  it('fills the fields the CLI knows first, keeps the template CHANGE_ME, and writes nothing when only planning', () => {
    comDiretorio('ticket-create-', (projetosDir) => {
      comProjeto(projetosDir, 'demo', ['3']);

      const planned = planTicket(projetosDir, 'demo', 'bug', ticketTemplatesDir(), { environment: 'qa' });
      expect(planned.ticket).toBe('demo-4');
      expect(planned.path).toBe(path.join(projetosDir, 'demo', 'tickets', '4.json'));
      expect(fs.existsSync(planned.path)).toBe(false);

      const created = createTicket(projetosDir, 'demo', 'bug', ticketTemplatesDir(), { environment: 'qa' });
      expect(created).toEqual(planned);
      const json = lerJson(created.path) as Record<string, unknown>;
      expect(Object.keys(json).slice(0, 4)).toEqual(['ticket', 'tipo', 'projeto', 'ambiente']);
      expect(json).toMatchObject({ ticket: 'demo-4', tipo: 'bug', projeto: 'demo', ambiente: 'qa' });
      expect(json['passosParaReproduzir']).toEqual(['CHANGE_ME']);
    });
  });

  it('leaves ambiente out without an environment, and lets no template override the CLI fields', () => {
    comDiretorio('ticket-override-', (projetosDir) => {
      comDiretorio('ticket-tpl-', (templatesDir) => {
        comProjeto(projetosDir, 'demo');
        fs.writeFileSync(
          path.join(templatesDir, 'x.json'),
          JSON.stringify({ description: 'X.', fields: { tipo: 'outro', titulo: 'CHANGE_ME' } }),
        );

        const json = lerJson(createTicket(projetosDir, 'demo', 'x', templatesDir).path);
        expect(json).toEqual({ ticket: 'demo-1', tipo: 'x', projeto: 'demo', titulo: 'CHANGE_ME' });
      });
    });
  });

  it('creates the tickets folder when the project has none', () => {
    comDiretorio('ticket-folder-', (projetosDir) => {
      comProjeto(projetosDir, 'demo');
      fs.rmSync(path.join(projetosDir, 'demo', 'tickets'), { recursive: true });

      expect(fs.existsSync(createTicket(projetosDir, 'demo', 'story', ticketTemplatesDir()).path)).toBe(true);
    });
  });

  it('rejects an unknown type listing the available ones, a malformed template, and a missing project', () => {
    comDiretorio('ticket-invalid-', (projetosDir) => {
      comDiretorio('ticket-tpl-', (templatesDir) => {
        comProjeto(projetosDir, 'demo');
        fs.writeFileSync(path.join(templatesDir, 'lista.json'), '[]');
        fs.writeFileSync(path.join(templatesDir, 'vazio.json'), JSON.stringify({ description: ' ', fields: {} }));
        fs.writeFileSync(path.join(templatesDir, 'sem-campos.json'), JSON.stringify({ description: 'x', fields: [] }));

        expect(() => planTicket(projetosDir, 'demo', 'spike', ticketTemplatesDir())).toThrow(
          'Tipo de ticket "spike" não existe (disponíveis: bug, improvement, story, task).',
        );
        for (const type of ['lista', 'vazio', 'sem-campos']) {
          expect(() => planTicket(projetosDir, 'demo', type, templatesDir)).toThrow(
            'o template precisa de "description" (texto) e "fields" (objeto).',
          );
        }
        expect(() => planTicket(projetosDir, 'fantasma', 'bug', ticketTemplatesDir())).toThrow(ProjectsError);
      });
    });
  });
});

describe('ticketPlaceholders', () => {
  it('lists every field still holding CHANGE_ME, however deep', () => {
    comDiretorio('ticket-placeholders-', (dir) => {
      const file = path.join(dir, 't.json');
      fs.writeFileSync(
        file,
        JSON.stringify({
          titulo: ' CHANGE_ME ',
          contexto: 'ok',
          passos: ['a', 'CHANGE_ME'],
          criterios: [{ id: 'CA-01', descricao: 'CHANGE_ME', testes: [] }],
          n: 1,
        }),
      );

      expect(ticketPlaceholders(file)).toEqual(['titulo', 'passos[1]', 'criterios[0].descricao']);
    });
  });

  it('is empty for a filled ticket', () => {
    comDiretorio('ticket-filled-', (dir) => {
      const file = path.join(dir, 't.json');
      fs.writeFileSync(file, JSON.stringify({ titulo: 'x', criterios: [] }));

      expect(ticketPlaceholders(file)).toEqual([]);
    });
  });
});
