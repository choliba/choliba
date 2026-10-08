import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  formatRetired,
  fullyRetiredTickets,
  retiredCriteria,
  retiredTestPatterns,
} from '../../tickets/ticket-superseded';

/** A project `demo` with the given tickets (`<suffix>.json` → its JSON). */
function withTickets(tickets: Record<string, unknown>, run: (projectsDir: string, ticketsDir: string) => void): void {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superseded-'));
  const ticketsDir = path.join(projectsDir, 'demo', 'tickets');
  try {
    fs.mkdirSync(ticketsDir, { recursive: true });
    for (const [suffix, json] of Object.entries(tickets)) {
      fs.writeFileSync(path.join(ticketsDir, `${suffix}.json`), JSON.stringify(json));
    }
    run(projectsDir, ticketsDir);
  } finally {
    fs.rmSync(projectsDir, { recursive: true, force: true });
  }
}

const OLD = {
  criterios: [
    { id: 'CA-01', testes: ['demo-1.spec.ts › CA-01: home (antiga)'] },
    { id: 'CA-02', testes: ['demo-1.spec.ts › CA-02: blog'] },
    { id: 'CA-03', testes: [] },
  ],
};

describe('retiredCriteria', () => {
  it('retires the criteria a ticket names, one by one or the whole ticket', () => {
    withTickets(
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

  it('retires nothing in a project whose tickets replace nothing, whatever shape they have', () => {
    withTickets({ '1': OLD, '2': [], '3': { criterios: [{ testes: 'x' }, 'x'] } }, (projectsDir) => {
      expect(retiredCriteria(projectsDir, 'demo')).toEqual([]);
    });
  });

  it.each([
    ['a ticket that does not exist', ['demo-9'], 'substitui[0]: o ticket demo-9 não existe.'],
    ['a criterion that does not exist', ['demo-1:CA-09'], 'substitui[0]: demo-1 não tem o critério CA-09.'],
    ['the ticket itself', ['1:CA-01', 'demo-2'], 'substitui[1]: um ticket não substitui a si mesmo.'],
    ['something that is not a list', 'demo-1', 'substitui precisa ser uma lista de referências'],
    ['an empty reference', [''], 'substitui precisa ser uma lista de referências'],
  ])('refuses %s, naming the file', (_label, substitui, message) => {
    withTickets({ '1': OLD, '2': { criterios: [{ id: 'CA-01' }], substitui } }, (projectsDir, ticketsDir) => {
      expect(() => retiredCriteria(projectsDir, 'demo')).toThrow(path.join(ticketsDir, '2.json'));
      expect(() => retiredCriteria(projectsDir, 'demo')).toThrow(message);
    });
  });
});

describe('fullyRetiredTickets', () => {
  it('names the tickets with every criterion retired, and only those', () => {
    withTickets(
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

describe('retiredTestPatterns', () => {
  const retired = [
    {
      ticket: 'demo-1',
      criterion: 'CA-01',
      by: 'demo-2',
      tests: ['demo-1.spec.ts › CA-01: home (antiga)', 'malformed'],
    },
    { ticket: 'demo-1', criterion: 'CA-02', by: 'demo-2', tests: ['demo-1.spec.ts › Blog › CA-02: lista'] },
  ];

  it("matches each retired test by its file inside the project and its exact title, as Playwright's grep sees it", () => {
    const patterns = retiredTestPatterns('demo', retired);
    const matched = (line: string): boolean => patterns.some((pattern) => pattern.test(line));

    expect(patterns).toHaveLength(2);
    expect(matched('chromium demo/tests/demo-1.spec.ts CA-01: home (antiga)')).toBe(true);
    expect(matched('chromium demo/tests/demo-1.spec.ts CA-01: home (antiga) @smoke')).toBe(true);
    expect(matched('chromium demo/tests/demo-1.spec.ts Blog CA-02: lista')).toBe(true);
    expect(matched('chromium demo/tests/demo-2.spec.ts CA-01: home (antiga)')).toBe(false);
    expect(matched('chromium outro/tests/demo-1.spec.ts CA-01: home (antiga)')).toBe(false);
    expect(matched('chromium demo/tests/demo-1.spec.ts CA-01: home (antiga) e mais')).toBe(false);
  });
});

describe('formatRetired', () => {
  it('says which criteria of which ticket are retired, and by which ticket', () => {
    expect(
      formatRetired([
        { ticket: 'demo-1', criterion: 'CA-01', by: 'demo-2', tests: [] },
        { ticket: 'demo-1', criterion: 'CA-02', by: 'demo-2', tests: [] },
        { ticket: 'demo-3', criterion: 'CA-01', by: 'demo-4', tests: [] },
      ]),
    ).toBe('aposentados: demo-1 CA-01, CA-02 (substituídos por demo-2); demo-3 CA-01 (substituídos por demo-4)');
  });
});
