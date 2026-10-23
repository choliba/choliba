import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ticketShapeProblems } from '@choliba/workspace';
import { ticketTemplatesDir } from '../../../projects/project-templates';

const CRITERION = { id: 'CA-01', descricao: ['Dado x', 'Quando y', 'Então z'], testes: [] };

const STORY = {
  ticket: 'app-1',
  tipo: 'story',
  projeto: 'app',
  titulo: 'Assinar a newsletter',
  contexto: 'Quem visita quer receber novidades.',
  evidencias: [],
  substitui: [],
  criterios: [CRITERION],
};

/** The problems of `ticket`, written to a file, against the package's own templates. */
function problemsOf(ticket: unknown): string[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-shape-'));
  try {
    const file = path.join(dir, '1.json');
    fs.writeFileSync(file, JSON.stringify(ticket));
    return ticketShapeProblems(file, ticketTemplatesDir());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('ticketShapeProblems', () => {
  it("accepts a ticket that keeps its type's template, with fields of its own besides", () => {
    expect(problemsOf(STORY)).toEqual([]);
    expect(problemsOf({ ...STORY, ambiente: 'qa', criterios: [{ ...CRITERION, devices: { firefox: true } }] })).toEqual(
      [],
    );
  });

  it('names each field of the template that is missing, in every criterion', () => {
    const { contexto: _contexto, ...noContext } = STORY;
    const { testes: _testes, ...noTests } = CRITERION;

    expect(problemsOf({ ...noContext, criterios: [CRITERION, noTests, { descricao: CRITERION.descricao }] })).toEqual([
      'contexto: falta',
      'criterios[1].testes: falta',
      'criterios[2].id: falta',
      'criterios[2].testes: falta',
    ]);
  });

  it('names a field of another kind than the template has', () => {
    expect(problemsOf({ ...STORY, titulo: ['x'], criterios: [{ ...CRITERION, descricao: 'Dado x' }] })).toEqual([
      'titulo: deve ser um texto, não uma lista',
      'criterios[0].descricao: deve ser uma lista, não um texto',
    ]);
    expect(problemsOf({ ...STORY, criterios: { ...CRITERION } })).toEqual([
      'criterios: deve ser uma lista, não um objeto',
    ]);
    expect(problemsOf({ ...STORY, evidencias: null, substitui: 1, titulo: true })).toEqual([
      'titulo: deve ser um texto, não um booleano',
      'evidencias: deve ser uma lista, não null',
      'substitui: deve ser uma lista, não um número',
    ]);
  });

  it("holds a bug to the bug's template", () => {
    expect(problemsOf({ ...STORY, tipo: 'bug' })).toEqual([
      'passosParaReproduzir: falta',
      'comportamentoEsperado: falta',
      'comportamentoAtual: falta',
    ]);
  });

  it('names the types there are when the ticket has none, or one with no template', () => {
    const { tipo: _tipo, ...untyped } = STORY;
    const expected = ['tipo: deve ser um dos tipos de ticket (bug, improvement, story, task)'];

    expect(problemsOf(untyped)).toEqual(expected);
    expect(problemsOf({ ...STORY, tipo: 'epic' })).toEqual(expected);
    expect(problemsOf([STORY])).toEqual(expected);
  });
});
