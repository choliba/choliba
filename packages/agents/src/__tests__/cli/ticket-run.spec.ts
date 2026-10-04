import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentDefinition } from '../../agent.types';
import { createPlannedTicket, finishTicket, resolveTicketTarget, ticketVars } from '../../cli/ticket-run';
import { makeTmpDir } from '../helpers/tmp';
import { NO_PERMISSIONS } from '../../permissions';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';

function fakeWritable(): { chunks: string[]; write: (chunk: string) => void } {
  const chunks: string[] = [];
  return { chunks, write: (chunk) => chunks.push(chunk) };
}

const plain: AgentDefinition = {
  name: 'echo',
  id: 'po-agent',
  displayName: 'PO',
  version: '1.0.0',
  description: 'd',
  supportedModels: [],
  skills: [],
  mcps: [],
  policy: 'edits',
  taskRequired: true,
  projectRequired: true,
  defaultMode: 'execute',
  modes: ['execute', 'plan', 'ask'],
  permissions: NO_PERMISSIONS,
  dir: '/repo/agents/po',
  sections: fakeSections(''),
  steps: NO_MODE_STEPS,
  sourcePath: '/repo/agents/po/agent.yaml',
};

const agent: AgentDefinition = { ...plain, name: 'po', ticketTypes: ['bug'] };

describe('ticketVars', () => {
  it('gives TICKET and TICKET_FILE, or nothing without a ticket', () => {
    expect(ticketVars({ ticket: 'red-1', file: '/p/1.json' })).toEqual({ TICKET: 'red-1', TICKET_FILE: '/p/1.json' });
    expect(ticketVars(undefined)).toEqual({});
  });
});

describe('resolveTicketTarget', () => {
  it('refuses --type and --ticket for an agent without ticket_types', () => {
    expect(() =>
      resolveTicketTarget(plain, { project: 'red', ticketType: 'bug', ticket: undefined }, () => '/p'),
    ).toThrow('"echo" não trabalha com tickets: --type e --ticket não se aplicam.');
    expect(
      resolveTicketTarget(plain, { project: 'red', ticketType: undefined, ticket: undefined }, () => '/p'),
    ).toBeUndefined();
  });

  it('needs a project for an agent with ticket_types', () => {
    expect(() =>
      resolveTicketTarget(agent, { project: undefined, ticketType: 'bug', ticket: undefined }, () => '/p'),
    ).toThrow('"po" precisa de --project para achar o ticket.');
  });
});

describe('createPlannedTicket', () => {
  it('writes nothing for an existing ticket', () => {
    expect(createPlannedTicket({ ticket: 'red-1', file: '/p/1.json' })).toBeUndefined();
    expect(createPlannedTicket(undefined)).toBeUndefined();
  });

  it('refuses when another ticket took the planned number in the meantime', () => {
    const tmp = makeTmpDir('ticket-run-race');
    try {
      const project = join(tmp.path, 'red');
      mkdirSync(join(project, 'tickets'), { recursive: true });
      writeFileSync(join(project, 'config.json'), '{}');
      writeFileSync(join(project, '.env.json'), '{}');
      writeFileSync(join(project, 'tickets', '1.json'), '{}');
      const target = {
        ticket: 'red-1',
        file: join(project, 'tickets', '1.json'),
        create: { projectsDir: tmp.path, project: 'red', type: 'bug', environment: 'qa' },
      };

      expect(() => createPlannedTicket(target)).toThrow('Outro ticket foi criado');
      expect(existsSync(join(project, 'tickets', '2.json'))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('finishTicket', () => {
  function withTicket(content: string, run: (file: string) => void): void {
    const tmp = makeTmpDir('ticket-run-finish');
    try {
      const file = join(tmp.path, '1.json');
      writeFileSync(file, content);
      run(file);
    } finally {
      tmp.cleanup();
    }
  }

  it('passes the exit code through without a ticket, or when the file is gone', () => {
    const stderr = fakeWritable();
    expect(finishTicket(undefined, undefined, 'execute', 3, stderr)).toBe(3);
    expect(finishTicket({ ticket: 'red-1', file: '/nope/1.json' }, 'x', 'execute', 0, stderr)).toBe(0);
    expect(stderr.chunks).toEqual([]);
  });

  it('fails an execute run that left CHANGE_ME, naming the fields', () => {
    withTicket('{"titulo":"CHANGE_ME","criterios":[{"descricao":"ok"}]}', (file) => {
      const stderr = fakeWritable();

      expect(finishTicket({ ticket: 'red-1', file }, undefined, 'execute', 0, stderr)).toBe(1);
      expect(stderr.chunks.join('')).toBe(`Ticket "red-1" ainda tem CHANGE_ME em: titulo (${file}).\n`);
    });
  });

  it('fails an execute run that left a criterion out of the Gherkin form, naming it', () => {
    withTicket('{"titulo":"ok","criterios":[{"descricao":"Dado x, Quando y, Então z"}]}', (file) => {
      const stderr = fakeWritable();

      expect(finishTicket({ ticket: 'red-1', file }, undefined, 'execute', 0, stderr)).toBe(1);
      expect(stderr.chunks.join('')).toBe(
        [
          `Ticket "red-1" tem critérios fora do formato (${file}):`,
          '  criterios[0].descricao: deve ser uma lista de frases (Dado…, Quando…, Então…), não um texto',
          '',
        ].join('\n'),
      );
    });
  });

  it('accepts a filled ticket, and checks nothing after a failed or non-execute run', () => {
    withTicket('{"titulo":"CHANGE_ME"}', (file) => {
      const stderr = fakeWritable();
      expect(finishTicket({ ticket: 'red-1', file }, 'outro', 'plan', 0, stderr)).toBe(0);
      expect(finishTicket({ ticket: 'red-1', file }, undefined, 'execute', 2, stderr)).toBe(2);
      expect(stderr.chunks).toEqual([]);
      expect(readFileSync(file, 'utf8')).toBe('{"titulo":"CHANGE_ME"}');
    });
    withTicket('{"titulo":"ok","criterios":[{"descricao":["Dado x","Quando y","Então z"]}]}', (file) => {
      expect(finishTicket({ ticket: 'red-1', file }, undefined, 'execute', 0, fakeWritable())).toBe(0);
    });
  });
});
