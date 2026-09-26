import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ProjectsError,
  projectDir,
  configJsonPath,
  envJsonPath,
  projectExists,
  ticketSuffix,
  fullTicket,
  parseTarget,
  resolveTicketsFolder,
  ticketJsonPath,
  canonicalizeSuffix,
  canonicalTicket,
  resolveTicketRunsFolder,
  resolveReportFolder,
  ticketSpecFiles,
  resolveTicketSpecFiles,
  listProjects,
  listProjectNames,
  createProject,
  listTicketKeys,
  listTickets,
  readProjectConfig,
} from '../index';

function comDiretorioTemporario<T>(fn: (projetosDir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-test-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function comTemplate<T>(fn: (templatesDir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-template-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ envs: [{ nome: 'qa', baseURL: '', default: true }] }),
    );
    fs.writeFileSync(path.join(dir, '.env.example.json'), JSON.stringify({ qa: {}, _global: {} }));
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'tickets'), { recursive: true });
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** O config.json de um projeto recém-criado: sem .env.json ele ainda não é projeto, então é lido direto. */
function lerConfigCriado(projetosDir: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(projetosDir, 'novo', 'config.json'), 'utf-8')) as unknown;
}

function comProjeto(projetosDir: string, projeto: string, ticketsExtra: string[] = []): void {
  const dir = path.join(projetosDir, projeto);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), '{}');
  fs.writeFileSync(path.join(dir, '.env.json'), '{}');
  if (ticketsExtra.length > 0) {
    const ticketsDir = path.join(dir, 'tickets');
    fs.mkdirSync(ticketsDir, { recursive: true });
    for (const nome of ticketsExtra) fs.writeFileSync(path.join(ticketsDir, `${nome}.json`), '{}');
  }
}

describe('projects', () => {
  it('projectDir/configJsonPath/projectExists', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'meu-projeto');
      expect(projectDir(projetosDir, 'meu-projeto')).toBe(path.join(projetosDir, 'meu-projeto'));
      expect(configJsonPath(projetosDir, 'meu-projeto')).toBe(path.join(projetosDir, 'meu-projeto', 'config.json'));
      expect(projectExists(projetosDir, 'meu-projeto')).toBe(true);
      expect(projectExists(projetosDir, 'nao-existe')).toBe(false);
      expect(envJsonPath(projetosDir, 'meu-projeto')).toBe(path.join(projetosDir, 'meu-projeto', '.env.json'));
    });
  });

  it('ticketSuffix tira o prefixo do projeto', () => {
    expect(ticketSuffix('tradetools', 'tradetools-COND-01')).toBe('COND-01');
    expect(ticketSuffix('tradetools', 'COND-01')).toBe('COND-01');
  });

  it('fullTicket garante o prefixo do projeto', () => {
    expect(fullTicket('tradetools', 'COND-01')).toBe('tradetools-COND-01');
    expect(fullTicket('tradetools', 'tradetools-COND-01')).toBe('tradetools-COND-01');
  });

  it('parseTarget separa projeto:ticket', () => {
    expect(parseTarget('tradetools:COND-01')).toEqual({ project: 'tradetools', rawTicket: 'COND-01' });
  });

  it('parseTarget rejeita alvo inválido', () => {
    expect(() => parseTarget('sem-dois-pontos')).toThrow(ProjectsError);
    expect(() => parseTarget('projeto:')).toThrow(ProjectsError);
    expect(() => parseTarget(':ticket')).toThrow(ProjectsError);
  });

  it('resolveTicketsFolder aponta para tickets/', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'meu-projeto');
      expect(resolveTicketsFolder(projetosDir, 'meu-projeto')).toBe(path.join(projetosDir, 'meu-projeto', 'tickets'));
    });
  });

  it('resolveTicketsFolder falha com projeto inexistente', () => {
    comDiretorioTemporario((projetosDir) => {
      expect(() => resolveTicketsFolder(projetosDir, 'fantasma')).toThrow(ProjectsError);
    });
  });

  it('ticketJsonPath junta tickets/ + sufixo + .json', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'tradetools', ['COND-01']);
      expect(ticketJsonPath(projetosDir, 'tradetools', 'tradetools-COND-01')).toBe(
        path.join(projetosDir, 'tradetools', 'tickets', 'COND-01.json'),
      );
    });
  });

  it('ticketJsonPath canonicaliza a caixa', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'tradetools', ['COND-01']);
      expect(ticketJsonPath(projetosDir, 'tradetools', 'tradetools-cond-01')).toBe(
        path.join(projetosDir, 'tradetools', 'tickets', 'COND-01.json'),
      );
    });
  });

  it('canonicalizeSuffix resolve caixa errada', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'tradetools', ['COND-01']);
      expect(canonicalizeSuffix(projetosDir, 'tradetools', 'cond-01')).toBe('COND-01');
    });
  });

  it('canonicalizeSuffix erra em colisão de caixa', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'tradetools', ['cond-01', 'COND-01']);
      expect(() => canonicalizeSuffix(projetosDir, 'tradetools', 'Cond-01')).toThrow(ProjectsError);
    });
  });

  it('canonicalTicket resolve qualquer forma de entrada', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'tradetools', ['COND-01']);
      for (const entrada of ['cond-01', 'COND-01', 'tradetools-cond-01']) {
        expect(canonicalTicket(projetosDir, 'tradetools', entrada)).toBe('tradetools-COND-01');
      }
    });
  });

  it('resolveReportFolder com e sem ticket', () => {
    const raiz = '/fake/ticket-runs-root';
    expect(resolveReportFolder(raiz, 'tradetools', 'tradetools-COND-01')).toBe(
      path.join(raiz, 'tradetools', 'ticket-runs', 'tradetools-COND-01', 'playwright-report'),
    );
    expect(resolveReportFolder(raiz, 'tradetools')).toBe(
      path.join(raiz, 'tradetools', 'ticket-runs', 'playwright-report'),
    );
  });

  it('resolveTicketRunsFolder com e sem ticket', () => {
    const raiz = '/fake/ticket-runs-root';
    expect(resolveTicketRunsFolder(raiz, 'tradetools', 'tradetools-COND-01')).toBe(
      path.join(raiz, 'tradetools', 'ticket-runs', 'tradetools-COND-01'),
    );
    expect(resolveTicketRunsFolder(raiz, 'tradetools')).toBe(path.join(raiz, 'tradetools', 'ticket-runs'));
  });

  it('ticketSpecFiles deriva specs únicos e ordenados', () => {
    const ticketJson = {
      criterios: [
        { id: 'CA-01', testes: ['b.spec.ts › describe › CA-01: x'] },
        { id: 'CA-02', testes: ['a.spec.ts › describe › CA-02: y', 'b.spec.ts › describe › CA-02: y'] },
      ],
    };
    expect(ticketSpecFiles(ticketJson)).toEqual(['a.spec.ts', 'b.spec.ts']);
  });

  it('resolveTicketSpecFiles lê ticket.json do disco', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'tradetools', ['COND-01']);
      fs.writeFileSync(
        path.join(projetosDir, 'tradetools', 'tickets', 'COND-01.json'),
        JSON.stringify({ criterios: [{ id: 'CA-01', testes: ['x.spec.ts › d › CA-01: y'] }] }),
      );
      expect(resolveTicketSpecFiles(projetosDir, 'tradetools', 'tradetools-COND-01')).toEqual(['x.spec.ts']);
    });
  });

  it('listProjects lista pastas com config.json, com env undefined enquanto não há .env.json', () => {
    comDiretorioTemporario((dir) => {
      fs.mkdirSync(path.join(dir, 'zebra'));
      fs.writeFileSync(path.join(dir, 'zebra', 'config.json'), '{"projeto":"zebra"}');
      fs.writeFileSync(path.join(dir, 'zebra', '.env.json'), '{}');
      fs.mkdirSync(path.join(dir, 'abacate'));
      fs.writeFileSync(path.join(dir, 'abacate', 'config.json'), '{"projeto":"abacate"}');
      fs.mkdirSync(path.join(dir, 'sem-config'));
      expect(listProjects(dir)).toEqual([
        { project: 'abacate', config: { projeto: 'abacate' }, env: undefined },
        { project: 'zebra', config: { projeto: 'zebra' }, env: {} },
      ]);
    });
  });

  it('listProjectNames só conta projetos válidos', () => {
    comDiretorioTemporario((dir) => {
      comProjeto(dir, 'zebra');
      comProjeto(dir, 'abacaxi');
      fs.mkdirSync(path.join(dir, 'nao-e-projeto'));
      expect(listProjectNames(dir)).toEqual(['abacaxi', 'zebra']);
    });
  });

  it('listTicketKeys devolve chaves completas em ordem', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'meu-projeto', ['02', '01']);
      expect(listTicketKeys(projetosDir, 'meu-projeto')).toEqual(['meu-projeto-01', 'meu-projeto-02']);
    });
  });

  it('listTickets lê JSON dos tickets existentes', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo', ['T-01']);
      fs.writeFileSync(path.join(projetosDir, 'demo', 'tickets', 'T-01.json'), '{"id":"T-01"}');
      expect(listTickets(projetosDir, 'demo')).toEqual([{ id: 'T-01' }]);
    });
  });

  it('listTickets devolve vazio quando a pasta não existe', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo');
      expect(listTickets(projetosDir, 'demo')).toEqual([]);
    });
  });

  it('readProjectConfig lê config.json', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo');
      fs.writeFileSync(path.join(projetosDir, 'demo', 'config.json'), '{"appDir":"src"}');
      fs.writeFileSync(path.join(projetosDir, 'demo', '.env.json'), '{}');
      expect(readProjectConfig(projetosDir, 'demo')).toEqual({ appDir: 'src' });
    });
  });

  it('readProjectConfig falha quando config.json não existe', () => {
    comDiretorioTemporario((projetosDir) => {
      expect(() => readProjectConfig(projetosDir, 'fantasma')).toThrow(ProjectsError);
    });
  });

  it('resolveTicketSpecFiles falha quando o ticket não existe', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo');
      expect(() => resolveTicketSpecFiles(projetosDir, 'demo', 'demo-T-01')).toThrow(ProjectsError);
    });
  });

  it('resolveTicketSpecFiles falha com JSON inválido', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo', ['T-01']);
      fs.writeFileSync(path.join(projetosDir, 'demo', 'tickets', 'T-01.json'), '{invalid');
      expect(() => resolveTicketSpecFiles(projetosDir, 'demo', 'demo-T-01')).toThrow(ProjectsError);
    });
  });

  it('canonicalizeSuffix returns exact suffix when file exists', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo', ['Exact-Case']);
      expect(canonicalizeSuffix(projetosDir, 'demo', 'Exact-Case')).toBe('Exact-Case');
    });
  });

  it('canonicalizeSuffix ignores non-json files in tickets folder', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo', ['T-01']);
      fs.writeFileSync(path.join(projetosDir, 'demo', 'tickets', 'readme.txt'), 'ignore');
      expect(canonicalizeSuffix(projetosDir, 'demo', 't-01')).toBe('T-01');
    });
  });

  it('ticketSpecFiles skips malformed test titles', () => {
    expect(ticketSpecFiles({ criterios: [{ testes: ['', 'valid.spec.ts › d › CA-01: x'] }] })).toEqual([
      'valid.spec.ts',
    ]);
  });

  it('ticketSpecFiles handles missing criterios and testes arrays', () => {
    expect(ticketSpecFiles({})).toEqual([]);
    expect(ticketSpecFiles({ criterios: [{}] })).toEqual([]);
  });

  it('canonicalizeSuffix returns suffix when tickets folder is missing', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo');
      expect(canonicalizeSuffix(projetosDir, 'demo', 'T-01')).toBe('T-01');
    });
  });

  it('canonicalizeSuffix returns the requested suffix when no json file matches', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo', ['T-01']);
      expect(canonicalizeSuffix(projetosDir, 'demo', 'missing')).toBe('missing');
    });
  });

  it('canonicalizeSuffix returns the stored suffix when case-insensitive match is unique', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'demo', ['Mixed-Case']);
      expect(canonicalizeSuffix(projetosDir, 'demo', 'mixed-case')).toBe('Mixed-Case');
    });
  });

  it('listProjects inclui .env.json quando presente', () => {
    comDiretorioTemporario((dir) => {
      comProjeto(dir, 'demo');
      fs.writeFileSync(path.join(dir, 'demo', '.env.json'), '{"url":"http://localhost"}');
      expect(listProjects(dir)).toEqual([{ project: 'demo', config: {}, env: { url: 'http://localhost' } }]);
    });
  });

  it('createProject copia o template pro novo projeto', () => {
    comDiretorioTemporario((projetosDir) => {
      comTemplate((templatesDir) => {
        createProject(projetosDir, 'novo', templatesDir);

        expect(fs.existsSync(path.join(projetosDir, 'novo', '.env.example.json'))).toBe(true);
        expect(fs.existsSync(path.join(projetosDir, 'novo', '.env.json'))).toBe(false);
        // Já é projeto sem .env.json; quem barra a execução até ele existir é o loadProjectSettings.
        expect(projectExists(projetosDir, 'novo')).toBe(true);
        expect(fs.existsSync(path.join(projetosDir, 'novo', 'tests'))).toBe(true);
        expect(fs.existsSync(path.join(projetosDir, 'novo', 'tickets'))).toBe(true);
        expect(lerConfigCriado(projetosDir)).toEqual({
          envs: [{ nome: 'qa', baseURL: '', default: true }],
          name: 'novo',
        });
      });
    });
  });

  it('createProject com baseUrl não falha se o template não tiver envs', () => {
    comDiretorioTemporario((projetosDir) => {
      const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-template-sem-envs-'));
      try {
        fs.writeFileSync(path.join(templatesDir, 'config.json'), '{}');
        expect(() => {
          createProject(projetosDir, 'novo', templatesDir);
        }).toThrow(`Template de projeto incompleto: falta ${path.join(templatesDir, '.env.example.json')}.`);
        expect(fs.existsSync(path.join(projetosDir, 'novo'))).toBe(false);

        fs.writeFileSync(path.join(templatesDir, '.env.example.json'), '{}');
        createProject(projetosDir, 'novo', templatesDir, { baseUrl: 'https://qa.exemplo.com' });

        expect(lerConfigCriado(projetosDir)).toEqual({ name: 'novo' });
      } finally {
        fs.rmSync(templatesDir, { recursive: true, force: true });
      }
    });
  });

  it('createProject preenche baseURL de todos os envs quando a opção é passada', () => {
    comDiretorioTemporario((projetosDir) => {
      comTemplate((templatesDir) => {
        createProject(projetosDir, 'novo', templatesDir, { baseUrl: 'https://qa.exemplo.com' });

        expect(lerConfigCriado(projetosDir)).toEqual({
          envs: [{ nome: 'qa', baseURL: 'https://qa.exemplo.com', default: true }],
          name: 'novo',
        });
      });
    });
  });

  it('createProject resolve um appDir relativo a partir da pasta do projeto e recusa um arquivo', () => {
    comDiretorioTemporario((projetosDir) => {
      comTemplate((templatesDir) => {
        fs.mkdirSync(path.join(projetosDir, 'app'));
        fs.writeFileSync(path.join(projetosDir, 'arquivo.txt'), '');

        expect(createProject(projetosDir, 'novo', templatesDir, { appDir: '../app' })).toEqual({});
        expect((lerConfigCriado(projetosDir) as { envs: { appDir: string }[] }).envs[0]?.appDir).toBe('../app');
        expect(() => createProject(projetosDir, 'outro', templatesDir, { appDir: '../arquivo.txt' })).toThrow(
          /não é uma pasta existente .*; o projeto não foi criado\./,
        );
        expect(fs.existsSync(path.join(projetosDir, 'outro'))).toBe(false);
      });
    });
  });

  it('createProject falha se o projeto já existir', () => {
    comDiretorioTemporario((projetosDir) => {
      comProjeto(projetosDir, 'ja-existe');
      comTemplate((templatesDir) => {
        expect(() => {
          createProject(projetosDir, 'ja-existe', templatesDir);
        }).toThrow(ProjectsError);
        expect(() => {
          createProject(projetosDir, 'ja-existe', templatesDir);
        }).toThrow(/já existe/);
      });
    });
  });

  it('createProject falha se o diretório de template não existir', () => {
    comDiretorioTemporario((projetosDir) => {
      expect(() => {
        createProject(projetosDir, 'novo', path.join(projetosDir, 'sem-template'));
      }).toThrow(ProjectsError);
      expect(projectExists(projetosDir, 'novo')).toBe(false);
    });
  });
});
