import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ExpectedError } from '@choliba/core';

import {
  canonicalizeSuffix,
  fullyRetiredTickets,
  listTicketSuffixes,
  resolveReportFolder,
  resolveTicketRunsFolder,
  resolveTicketRunsRoot,
  resolveTicketSpecFiles,
  retiredCriteria,
  ticketJsonPath,
  ticketSpecFiles,
} from '../../app';

const OLD = {
  criterios: [
    { id: 'CA-01', testes: ['demo-1.spec.ts › CA-01: home (antiga)'] },
    { id: 'CA-02', testes: ['demo-1.spec.ts › CA-02: blog'] },
    { id: 'CA-03', testes: [] },
  ],
};

function withProject(tickets: Record<string, unknown>, run: (projectsDir: string) => void): void {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-tickets-'));
  const projectDir = path.join(projectsDir, 'demo');
  const ticketsDir = path.join(projectDir, 'tickets');
  try {
    fs.mkdirSync(ticketsDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'config.json'), '{}');
    for (const [suffix, json] of Object.entries(tickets)) {
      fs.writeFileSync(path.join(ticketsDir, `${suffix}.json`), JSON.stringify(json));
    }
    run(projectsDir);
  } finally {
    fs.rmSync(projectsDir, { recursive: true, force: true });
  }
}

describe('retiredCriteria', () => {
  it('retires the criteria a ticket names, one by one or the whole ticket', () => {
    withProject(
      { '1': OLD, '2': { substitui: ['demo-1:CA-01', '1:CA-02'] }, '3': { substitui: ['demo-1'] }, '4': {} },
      (projectsDir) => {
        expect(retiredCriteria(projectsDir, 'demo')).toEqual([
          { ticket: 'demo-1', criterion: 'CA-01', by: 'demo-2', tests: ['demo-1.spec.ts › CA-01: home (antiga)'] },
          { ticket: 'demo-1', criterion: 'CA-02', by: 'demo-2', tests: ['demo-1.spec.ts › CA-02: blog'] },
          { ticket: 'demo-1', criterion: 'CA-01', by: 'demo-3', tests: ['demo-1.spec.ts › CA-01: home (antiga)'] },
          { ticket: 'demo-1', criterion: 'CA-02', by: 'demo-3', tests: ['demo-1.spec.ts › CA-02: blog'] },
          { ticket: 'demo-1', criterion: 'CA-03', by: 'demo-3', tests: [] },
        ]);
      },
    );
  });

  it('retires nothing when tickets replace nothing, whatever shape they have', () => {
    withProject({ '1': OLD, '2': [], '3': { criterios: [{ testes: 'x' }, 'x'] } }, (projectsDir) => {
      expect(retiredCriteria(projectsDir, 'demo')).toEqual([]);
    });
  });

  it('names the file when a replacement is wrong', () => {
    withProject({ '1': OLD, '2': { criterios: [{ id: 'CA-01' }], substitui: ['demo-9'] } }, (projectsDir) => {
      expect(() => retiredCriteria(projectsDir, 'demo')).toThrow(ExpectedError);
      expect(() => retiredCriteria(projectsDir, 'demo')).toThrow('o ticket demo-9 não existe');
    });
  });
});

describe('fullyRetiredTickets', () => {
  it('names the tickets with every criterion retired, and only those', () => {
    withProject(
      {
        '1': OLD,
        '2': { substitui: ['demo-1:CA-01', 'demo-1:CA-02', 'demo-1:CA-03'] },
        '5': { criterios: [{ id: 'CA-01' }, { id: 'CA-02' }] },
        '6': { substitui: ['demo-5:CA-01'] },
        '7': { criterios: [] },
      },
      (projectsDir) => {
        expect([...fullyRetiredTickets(projectsDir, 'demo')]).toEqual(['demo-1']);
      },
    );
  });
});

describe('ticket files on disk', () => {
  it('canonicalizes a unique suffix and refuses a case-only collision', () => {
    withProject({ 'COND-01': {} }, (projectsDir) => {
      expect(canonicalizeSuffix(projectsDir, 'demo', 'cond-01')).toBe('COND-01');
      expect(canonicalizeSuffix(projectsDir, 'demo', 'COND-01')).toBe('COND-01');
      expect(canonicalizeSuffix(projectsDir, 'demo', 'missing')).toBe('missing');
      expect(ticketJsonPath(projectsDir, 'demo', 'demo-cond-01')).toBe(
        path.join(projectsDir, 'demo', 'tickets', 'COND-01.json'),
      );
    });
    withProject({ 'cond-01': {}, 'COND-01': {} }, (projectsDir) => {
      expect(() => canonicalizeSuffix(projectsDir, 'demo', 'Cond-01')).toThrow(ExpectedError);
      expect(() => canonicalizeSuffix(projectsDir, 'demo', 'Cond-01')).toThrow('casa com mais de um ticket');
    });
  });

  it('reads spec files from a ticket and fails when it is missing or not JSON', () => {
    expect(ticketSpecFiles({})).toEqual([]);
    expect(ticketSpecFiles({ criterios: [{}] })).toEqual([]);
    expect(ticketSpecFiles({ criterios: [{ testes: ['', 'valid.spec.ts › d › CA-01: x'] }] })).toEqual([
      'valid.spec.ts',
    ]);
    expect(
      ticketSpecFiles({
        criterios: [
          { testes: ['b.spec.ts › describe › CA-01: x'] },
          { testes: ['a.spec.ts › describe › CA-02: y', 'b.spec.ts › describe › CA-02: y'] },
        ],
      }),
    ).toEqual(['a.spec.ts', 'b.spec.ts']);
    withProject({ 'T-01': { criterios: [{ id: 'CA-01', testes: ['x.spec.ts › d › CA-01: y'] }] } }, (projectsDir) => {
      expect(resolveTicketSpecFiles(projectsDir, 'demo', 'demo-T-01')).toEqual(['x.spec.ts']);
      expect(() => resolveTicketSpecFiles(projectsDir, 'demo', 'demo-missing')).toThrow(
        'Ticket "demo-missing" não encontrado',
      );
      fs.writeFileSync(path.join(projectsDir, 'demo', 'tickets', 'T-01.json'), '{');
      expect(() => resolveTicketSpecFiles(projectsDir, 'demo', 'demo-T-01')).toThrow('não é um JSON válido');
    });
  });

  it('lists suffixes of json tickets and the runs folders of a ticket', () => {
    withProject({ '02': {}, '01': {} }, (projectsDir) => {
      expect(listTicketSuffixes(path.join(projectsDir, 'demo', 'tickets'))).toEqual(['01', '02']);
      expect(listTicketSuffixes(path.join(projectsDir, 'demo', 'missing'))).toEqual([]);
    });
    expect(resolveTicketRunsRoot({ CHOL_PROJECTS_DIR: '/p', CHOL_TICKET_RUNS: ' /r ' })).toBe('/r');
    expect(resolveTicketRunsRoot({ CHOL_PROJECTS_DIR: '/p', CHOL_TICKET_RUNS: '  ' })).toBe('/p');
    expect(resolveTicketRunsFolder('/r', 'demo')).toBe(path.join('/r', 'demo', 'ticket-runs'));
    expect(resolveReportFolder('/r', 'demo', 'demo-1')).toBe(
      path.join('/r', 'demo', 'ticket-runs', 'demo-1', 'playwright-report'),
    );
  });
});
