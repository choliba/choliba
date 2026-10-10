import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Writable } from '@choliba/core';

import { installSilentTerminal } from '../helpers/silent-terminal';
import { anchorSpecFile, fillTicketTests, shortTitle, specFileFromFullTitle } from '../../tests/fill-ticket-tests';

function fakeWritable(): Writable & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
}

function withFixture(fn: (projectsDir: string, reportDir: string) => void): void {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fill-ticket-'));
  try {
    const project = 'demo';
    const projectDir = path.join(projectsDir, project);
    fs.mkdirSync(path.join(projectDir, 'tickets'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, 'config.json'),
      JSON.stringify({ envs: [{ nome: 'development', baseURL: 'http://localhost/', appDir: '/app' }] }),
    );
    fs.writeFileSync(path.join(projectDir, '.env.json'), JSON.stringify({ development: {} }));

    const reportDir = path.join(projectsDir, project, 'ticket-runs', 'demo-T-01', 'playwright-report');
    fs.mkdirSync(reportDir, { recursive: true });
    fn(projectsDir, reportDir);
  } finally {
    fs.rmSync(projectsDir, { recursive: true, force: true });
  }
}

describe('fill-ticket helpers', () => {
  it('shortTitle keeps describe segments and basename the spec file', () => {
    expect(shortTitle('/tmp/nested/alpha.spec.ts › suite › CA-01: ok')).toBe('alpha.spec.ts › suite › CA-01: ok');
    expect(shortTitle('solo')).toBe('solo');
    expect(shortTitle(' › tail only')).toBe(' › tail only');
  });

  it('specFileFromFullTitle returns the first segment', () => {
    expect(specFileFromFullTitle('alpha.spec.ts › suite › CA-01: ok')).toBe('alpha.spec.ts');
    expect(specFileFromFullTitle('solo')).toBe('solo');
  });

  it('anchorSpecFile picks the most referenced spec file', () => {
    expect(anchorSpecFile({})).toBeNull();
    expect(anchorSpecFile({ criterios: [{ id: 'CA-01', testes: [''] }] })).toBeNull();
    expect(
      anchorSpecFile({
        criterios: [
          { id: 'CA-01', testes: ['a.spec.ts › d › CA-01: x'] },
          { id: 'CA-02', testes: ['a.spec.ts › d › CA-02: y', 'b.spec.ts › d › CA-02: z'] },
        ],
      }),
    ).toBe('a.spec.ts');
    expect(
      anchorSpecFile({
        criterios: [
          { id: 'CA-01', testes: ['a.spec.ts › d › CA-01: x'] },
          { id: 'CA-02', testes: ['a.spec.ts › d › CA-02: y'] },
          { id: 'CA-03', testes: ['b.spec.ts › d › CA-03: z'] },
        ],
      }),
    ).toBe('a.spec.ts');
  });
});

describe('fillTicketTests', () => {
  let restoreTerminal: () => void;

  beforeEach(() => {
    restoreTerminal = installSilentTerminal();
  });

  afterEach(() => {
    restoreTerminal();
  });

  it('rejects invalid target format', () => {
    expect(() => {
      fillTicketTests('invalid', { CHOL_PROJECTS_DIR: '/projects' });
    }).toThrow('use <project>:<ticket>');
  });

  it('reports nothing new when criteria already have tests', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(
        ticketPath,
        JSON.stringify({ criterios: [{ id: 'CA-01', testes: ['a.spec.ts › d › CA-01: ok'] }] }),
      );
      fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify({ suites: [] }));

      const stdout = fakeWritable();
      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      expect(stdout.chunks.join('')).toContain('Nada novo');
    });
  });

  it('fills empty criteria from playwright results', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(
        ticketPath,
        JSON.stringify({
          criterios: [{ id: 'CA-01', testes: ['anchor.spec.ts › d › CA-00: anchor'] }, { id: 'CA-02' }],
        }),
      );
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'anchor.spec.ts',
              specs: [
                {
                  title: 'CA-02: filled from results',
                  tests: [{ status: 'expected', results: [{ status: 'passed' }] }],
                },
              ],
            },
          ],
        }),
      );

      const stdout = fakeWritable();
      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      const saved = JSON.parse(fs.readFileSync(ticketPath, 'utf-8')) as {
        criterios: { id: string; testes?: string[] }[];
      };
      expect(saved.criterios[1]?.testes).toEqual(['anchor.spec.ts › CA-02: filled from results']);
      expect(stdout.chunks.join('')).toContain('testes[] preenchido');
    });
  });

  it('uses the default stderr writer when only stdout is provided', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'a.spec.ts',
              specs: [{ title: 'CA-01: one', tests: [{ status: 'expected', results: [] }] }],
            },
            {
              title: 'b.spec.ts',
              specs: [{ title: 'CA-01: two', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      expect(stdout.chunks.join('')).toContain('Nada novo');
    });
  });

  it('uses the default stderr writer when stderr is omitted', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'a.spec.ts',
              specs: [{ title: 'CA-01: one', tests: [{ status: 'expected', results: [] }] }],
            },
            {
              title: 'b.spec.ts',
              specs: [{ title: 'CA-01: two', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );

      expect(() => {
        fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir });
      }).not.toThrow();
    });
  });

  it('warns about ambiguous criteria matches', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'a.spec.ts',
              specs: [{ title: 'CA-01: one', tests: [{ status: 'expected', results: [] }] }],
            },
            {
              title: 'b.spec.ts',
              specs: [{ title: 'CA-01: two', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );

      const stderr = fakeWritable();
      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stderr });

      expect(stderr.chunks.join('')).toContain('colidiu');
    });
  });

  it('uses default stdout and stderr writers when output is omitted', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(
        ticketPath,
        JSON.stringify({ criterios: [{ id: 'CA-01', testes: ['a.spec.ts › d › CA-01: ok'] }] }),
      );
      fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify({ suites: [] }));

      expect(() => {
        fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir });
      }).not.toThrow();
    });
  });

  it('throws when ticket or results.json is missing', () => {
    withFixture((projectsDir) => {
      expect(() => {
        fillTicketTests('demo:MISSING', { CHOL_PROJECTS_DIR: projectsDir });
      }).toThrow('Ticket não encontrado');
      fs.writeFileSync(path.join(projectsDir, 'demo', 'tickets', 'T-01.json'), '{}');
      expect(() => {
        fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir });
      }).toThrow('Nenhum results.json');
    });
  });

  it('uses default stdout when only stderr is provided', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'alpha.spec.ts',
              specs: [{ title: 'CA-01: ok', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );
      const stderr = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stderr });

      const saved = JSON.parse(fs.readFileSync(ticketPath, 'utf-8')) as {
        criterios: { id: string; testes?: string[] }[];
      };
      expect(saved.criterios[0]?.testes).toEqual(['alpha.spec.ts › CA-01: ok']);
    });
  });

  it('uses default stdout when stdout is omitted', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'alpha.spec.ts',
              specs: [{ title: 'CA-01: ok', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir });

      const saved = JSON.parse(fs.readFileSync(ticketPath, 'utf-8')) as {
        criterios: { id: string; testes?: string[] }[];
      };
      expect(saved.criterios[0]?.testes).toEqual(['alpha.spec.ts › CA-01: ok']);
    });
  });

  it('uses projectsDir when CHOL_TICKET_RUNS is blank', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(
        ticketPath,
        JSON.stringify({ criterios: [{ id: 'CA-01', testes: ['a.spec.ts › d › CA-01: ok'] }] }),
      );
      fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify({ suites: [] }));
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: '   ' }, { stdout });

      expect(stdout.chunks.join('')).toContain('Nada novo');
    });
  });

  it('skips criteria without matching playwright results', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-99' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            { title: 'a.spec.ts', specs: [{ title: 'CA-01: other', tests: [{ status: 'expected', results: [] }] }] },
          ],
        }),
      );
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      expect(stdout.chunks.join('')).toContain('Nada novo');
    });
  });

  it('skips criteria when the result title does not match the criterion id prefix', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'a.spec.ts',
              specs: [{ title: 'CA-99: unrelated', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      expect(stdout.chunks.join('')).toContain('Nada novo');
    });
  });

  it('skips criteria with failures or without expected runs', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }, { id: 'CA-02' }, { id: 'CA-03' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'a.spec.ts',
              specs: [
                { title: 'CA-01: failed', tests: [{ status: 'unexpected', results: [] }] },
                { title: 'CA-02: skipped', tests: [{ status: 'skipped', results: [] }] },
                { title: 'CA-03: ok', tests: [{ status: 'expected', results: [] }] },
              ],
            },
          ],
        }),
      );
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      const saved = JSON.parse(fs.readFileSync(ticketPath, 'utf-8')) as {
        criterios: { id: string; testes?: string[] }[];
      };
      expect(saved.criterios[0]?.testes).toBeUndefined();
      expect(saved.criterios[1]?.testes).toBeUndefined();
      expect(saved.criterios[2]?.testes).toEqual(['a.spec.ts › CA-03: ok']);
      expect(stdout.chunks.join('')).toContain('testes[] preenchido');
    });
  });

  it('warns when matched files diverge from the anchor spec', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(
        ticketPath,
        JSON.stringify({
          criterios: [{ id: 'CA-00', testes: ['anchor.spec.ts › d › CA-00: anchor'] }, { id: 'CA-02' }],
        }),
      );
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'other.spec.ts',
              specs: [{ title: 'CA-02: elsewhere', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );
      const stderr = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stderr });

      expect(stderr.chunks.join('')).toContain('colidiu');
    });
  });

  it('uses process.env by default and shortens nested spec paths', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: path.join('nested', 'dir', 'alpha.spec.ts'),
              specs: [{ title: 'CA-01: ok', tests: [{ status: 'flaky', results: [] }] }],
            },
          ],
        }),
      );
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir }, { stdout, stderr: fakeWritable() });

      const saved = JSON.parse(fs.readFileSync(ticketPath, 'utf-8')) as {
        criterios: { id: string; testes?: string[] }[];
      };
      expect(saved.criterios[0]?.testes).toEqual(['alpha.spec.ts › CA-01: ok']);
    });
  });

  it('handles tickets without a criterios array', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, '{}');
      fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify({ suites: [] }));
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      expect(stdout.chunks.join('')).toContain('Nada novo');
    });
  });

  it('handles tickets without criterios and ignores empty anchor entries', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(
        ticketPath,
        JSON.stringify({
          criterios: [{ id: 'CA-01', testes: [''] }, { id: 'CA-02' }],
        }),
      );
      fs.writeFileSync(
        path.join(reportDir, 'results.json'),
        JSON.stringify({
          suites: [
            {
              title: 'alpha.spec.ts',
              specs: [{ title: 'CA-02: ok', tests: [{ status: 'expected', results: [] }] }],
            },
          ],
        }),
      );
      const stdout = fakeWritable();

      fillTicketTests(
        'demo:T-01',
        { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir },
        { stdout, stderr: fakeWritable() },
      );

      const saved = JSON.parse(fs.readFileSync(ticketPath, 'utf-8')) as {
        criterios: { id: string; testes?: string[] }[];
      };
      expect(saved.criterios[1]?.testes).toEqual(['alpha.spec.ts › CA-02: ok']);
    });
  });

  it('handles results.json without suites', () => {
    withFixture((projectsDir, reportDir) => {
      const ticketPath = path.join(projectsDir, 'demo', 'tickets', 'T-01.json');
      fs.writeFileSync(ticketPath, JSON.stringify({ criterios: [{ id: 'CA-01' }] }));
      fs.writeFileSync(path.join(reportDir, 'results.json'), '{}');
      const stdout = fakeWritable();

      fillTicketTests('demo:T-01', { CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: projectsDir }, { stdout });

      expect(stdout.chunks.join('')).toContain('Nada novo');
    });
  });
});
