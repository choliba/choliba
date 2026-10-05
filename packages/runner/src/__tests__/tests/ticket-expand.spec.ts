import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  expandTicketCsvList,
  expandTicketRange,
  expandTicketSelector,
  isMultiTicketSelector,
  listMatchingTicketKeys,
  stripProjectPrefix,
  trim,
} from '../../tests/ticket-expand';

function withProjectsDir(fn: (projectsDir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-expand-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeTicket(projectsDir: string, project: string, suffix: string): void {
  const projectDir = path.join(projectsDir, project);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'config.json'),
    JSON.stringify({ envs: [{ nome: 'development', baseURL: 'http://localhost/', appDir: '/app' }] }),
  );
  fs.writeFileSync(path.join(projectDir, '.env.json'), JSON.stringify({ development: {} }));
  const ticketsDir = path.join(projectDir, 'tickets');
  fs.mkdirSync(ticketsDir, { recursive: true });
  fs.writeFileSync(path.join(ticketsDir, `${suffix}.json`), '{}');
}

describe('ticket-expand', () => {
  it('trim and stripProjectPrefix normalize ticket input', () => {
    expect(trim('  x  ')).toBe('x');
    expect(stripProjectPrefix('demo', 'demo-T-01')).toBe('T-01');
    expect(stripProjectPrefix('demo', 'T-01')).toBe('T-01');
  });

  it('isMultiTicketSelector detects globs, lists and ranges', () => {
    expect(isMultiTicketSelector('CAD-*')).toBe(true);
    expect(isMultiTicketSelector('A,B')).toBe(true);
    expect(isMultiTicketSelector('CAD-01 - CAD-03')).toBe(true);
    expect(isMultiTicketSelector('CAD-01-CAD-03')).toBe(true);
    expect(isMultiTicketSelector('CAD-01')).toBe(false);
  });

  it('listMatchingTicketKeys finds glob and substring matches', () => {
    withProjectsDir((projectsDir) => {
      writeTicket(projectsDir, 'demo', 'CAD-01');
      writeTicket(projectsDir, 'demo', 'CAD-02');
      writeTicket(projectsDir, 'demo', 'OTHER-01');

      expect(listMatchingTicketKeys(projectsDir, 'demo', 'CAD-*')).toEqual(['demo-CAD-01', 'demo-CAD-02']);
      expect(listMatchingTicketKeys(projectsDir, 'demo', 'other')).toEqual(['demo-OTHER-01']);
      expect(listMatchingTicketKeys(projectsDir, 'demo', 'missing')).toEqual([]);
      fs.writeFileSync(path.join(projectsDir, 'demo', 'tickets', 'readme.txt'), 'ignore');
      expect(listMatchingTicketKeys(projectsDir, 'demo', 'CAD-*')).toEqual(['demo-CAD-01', 'demo-CAD-02']);
    });
  });

  it('listMatchingTicketKeys returns empty when tickets folder is missing', () => {
    withProjectsDir((projectsDir) => {
      const projectDir = path.join(projectsDir, 'demo');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, 'config.json'),
        JSON.stringify({ envs: [{ nome: 'development', baseURL: 'http://localhost/', appDir: '/app' }] }),
      );
      fs.writeFileSync(path.join(projectDir, '.env.json'), JSON.stringify({ development: {} }));

      expect(listMatchingTicketKeys(projectsDir, 'demo', 'CAD-*')).toEqual([]);
    });
  });

  it('expandTicketRange generates existing tickets in order', () => {
    withProjectsDir((projectsDir) => {
      writeTicket(projectsDir, 'demo', 'CAD-01');
      writeTicket(projectsDir, 'demo', 'CAD-03');

      expect(expandTicketRange(projectsDir, 'demo', 'CAD-01', 'CAD-03')).toEqual(['demo-CAD-01', 'demo-CAD-03']);
    });
  });

  it('expandTicketRange accepts numeric-only suffixes', () => {
    withProjectsDir((projectsDir) => {
      writeTicket(projectsDir, 'demo', '1');
      writeTicket(projectsDir, 'demo', '2');

      expect(expandTicketRange(projectsDir, 'demo', '1', '2')).toEqual(['demo-1', 'demo-2']);
    });
  });

  it('expandTicketRange rejects invalid ranges', () => {
    withProjectsDir((projectsDir) => {
      expect(() => expandTicketRange(projectsDir, 'demo', 'A', 'B')).toThrow('intervalo precisa');

      writeTicket(projectsDir, 'demo', 'A-01');
      expect(() => expandTicketRange(projectsDir, 'demo', 'A-01', 'B-01')).toThrow('prefixos diferentes');
      expect(() => expandTicketRange(projectsDir, 'demo', 'CAD-03', 'CAD-01')).toThrow('intervalo invertido');
      expect(() => expandTicketRange(projectsDir, 'demo', 'CAD-01', 'CAD-03')).toThrow('nenhum ticket');
    });
  });

  it('expandTicketCsvList resolves listed tickets', () => {
    withProjectsDir((projectsDir) => {
      writeTicket(projectsDir, 'demo', 'T-01');
      writeTicket(projectsDir, 'demo', 'T-02');

      expect(expandTicketCsvList(projectsDir, 'demo', 'T-01, demo-T-02')).toEqual(['demo-T-01', 'demo-T-02']);
      expect(() => expandTicketCsvList(projectsDir, 'demo', 'missing')).toThrow('não existe');
      expect(() => expandTicketCsvList(projectsDir, 'demo', ' , ')).toThrow('lista de tickets vazia');
    });
  });

  it('expandTicketSelector handles glob, csv, spaced range and compact range', () => {
    withProjectsDir((projectsDir) => {
      writeTicket(projectsDir, 'demo', 'CAD-01');
      writeTicket(projectsDir, 'demo', 'CAD-02');

      expect(expandTicketSelector(projectsDir, 'demo', 'CAD-*')).toEqual(['demo-CAD-01', 'demo-CAD-02']);
      expect(expandTicketSelector(projectsDir, 'demo', 'CAD-01,CAD-02')).toEqual(['demo-CAD-01', 'demo-CAD-02']);
      expect(expandTicketSelector(projectsDir, 'demo', 'CAD-01 - CAD-02')).toEqual(['demo-CAD-01', 'demo-CAD-02']);
      expect(expandTicketSelector(projectsDir, 'demo', 'CAD-01-CAD-02')).toEqual(['demo-CAD-01', 'demo-CAD-02']);
      expect(() => expandTicketSelector(projectsDir, 'demo', 'MISSING-*')).toThrow('nenhum ticket');
      expect(() => expandTicketSelector(projectsDir, 'demo', 'weird')).toThrow('não reconhecido');
      expect(() => expandTicketSelector(projectsDir, 'demo', ' - ')).toThrow('não reconhecido');
      expect(() => expandTicketSelector(projectsDir, 'demo', ' - CAD-02')).toThrow('não reconhecido');
      expect(() => expandTicketSelector(projectsDir, 'demo', 'CAD-01 - ')).toThrow('não reconhecido');
      expect(() => expandTicketSelector(projectsDir, 'demo', 'CAD-01-FOO-02')).toThrow('não reconhecido');
      expect(() => expandTicketSelector(projectsDir, 'demo', 'CAD-01 -  - CAD-02')).toThrow('não reconhecido');
    });
  });
});
