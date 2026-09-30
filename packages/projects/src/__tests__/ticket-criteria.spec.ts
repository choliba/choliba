import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  criteriaProblems,
  listTicketTypes,
  readTicketTemplate,
  ticketCriteriaProblems,
  ticketTemplatesDir,
} from '../index';

/** The problems of a ticket with one criterion whose `descricao` is `description`. */
function problemsOf(description: unknown): string[] {
  return criteriaProblems({ criterios: [{ id: 'CA-01', descricao: description, testes: [] }] });
}

describe('criteriaProblems', () => {
  it('accepts one step of each, without E', () => {
    expect(problemsOf(['Dado que estou na loja', 'Quando clico em Assinar', 'Então vejo "Obrigado"'])).toEqual([]);
  });

  it('accepts E and Mas continuing any step', () => {
    expect(
      problemsOf([
        'Dado que estou na loja',
        'E não informei o e-mail',
        'Quando clico em Assinar',
        'E espero a resposta',
        'Então vejo "Informe o e-mail"',
        'E o campo fica em destaque',
        'Mas nenhuma assinatura é criada',
      ]),
    ).toEqual([]);
  });

  it('accepts a keyword followed by a comma', () => {
    expect(problemsOf(['Dado x', 'Quando y', 'Então, ao atualizar, vejo z', 'E, na lista, vejo w'])).toEqual([]);
    expect(problemsOf(['Dado x', 'Quando y', 'Então z', 'Entãozinho w'])[0]).toContain('frase sem palavra-chave');
  });

  it('refuses a text instead of a list', () => {
    expect(problemsOf('Dado x, Quando y, Então z')).toEqual([
      'criterios[0].descricao: deve ser uma lista de frases (Dado…, Quando…, Então…), não um texto',
    ]);
  });

  it('refuses an empty list, naming what is missing', () => {
    expect(problemsOf([])).toEqual(['criterios[0].descricao: falta "Dado", "Quando", "Então"']);
    expect(problemsOf(['Dado x', 'Quando y'])).toEqual(['criterios[0].descricao: falta "Então"']);
  });

  it('refuses an empty step and a step without a keyword, Ou included', () => {
    expect(problemsOf(['Dado x', ' ', 'Quando y', 'Então z'])).toEqual(['criterios[0].descricao[1]: frase vazia']);
    expect(problemsOf(['Dado x', 'Quando y', 'Então z', 'Ou w'])).toEqual([
      'criterios[0].descricao[3]: frase sem palavra-chave (Dado, Quando, Então, E, Mas): "Ou w"',
    ]);
    expect(problemsOf(['Dado x', 'Quando y', 'Então z', 7])).toEqual(['criterios[0].descricao[3]: frase vazia']);
  });

  it('refuses a first step other than Dado', () => {
    expect(problemsOf(['Quando y', 'Então z'])).toEqual([
      'criterios[0].descricao[0]: a primeira frase começa com "Dado" ("Quando y")',
    ]);
    expect(problemsOf(['E x', 'Quando y', 'Então z'])).toEqual([
      'criterios[0].descricao[0]: a primeira frase começa com "Dado" ("E x")',
    ]);
  });

  it('refuses Então before Quando, and a repeated keyword', () => {
    expect(problemsOf(['Dado x', 'Então z', 'Quando y'])).toEqual([
      'criterios[0].descricao[1]: "Então" antes de "Quando"',
    ]);
    expect(problemsOf(['Dado x', 'Quando y', 'Quando w', 'Então z'])).toEqual([
      'criterios[0].descricao[2]: "Quando" repetido; continue com "E" ou "Mas"',
    ]);
  });

  it('checks every criterion, and nothing without criteria', () => {
    expect(
      criteriaProblems({
        criterios: [{ descricao: ['Dado x', 'Quando y', 'Então z'] }, 'x', { descricao: 'texto' }],
      }),
    ).toEqual(['criterios[2].descricao: deve ser uma lista de frases (Dado…, Quando…, Então…), não um texto']);
    expect(criteriaProblems({ titulo: 'x' })).toEqual([]);
    expect(criteriaProblems('x')).toEqual([]);
  });

  it('accepts every ticket template once its CHANGE_ME is filled', () => {
    const dir = ticketTemplatesDir();
    for (const type of listTicketTypes(dir)) {
      const filled: unknown = JSON.parse(
        JSON.stringify(readTicketTemplate(dir, type).fields).replaceAll('CHANGE_ME', 'x'),
      );
      expect(criteriaProblems(filled)).toEqual([]);
    }
  });
});

describe('ticketCriteriaProblems', () => {
  it('reads the ticket file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'criteria-'));
    try {
      const file = path.join(dir, '1.json');
      fs.writeFileSync(file, JSON.stringify({ criterios: [{ descricao: ['Quando y', 'Então z'] }] }));
      expect(ticketCriteriaProblems(file)).toEqual([
        'criterios[0].descricao[0]: a primeira frase começa com "Dado" ("Quando y")',
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
