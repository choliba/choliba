import { Table, TableError, td, th } from '../../terminal';

const RUN = new Table({
  head: [[th('provider'), th('sandbox'), th('imagem'), th('decorrido', { abbr: 'tempo' })]],
  bodies: [[[td('cursor'), td('docker'), td('choliba-agent:latest'), td('00:01:42')]]],
});

describe('Table', () => {
  it('lays the head and the body out in columns, a rule between the groups', () => {
    expect(RUN.render(80)).toEqual([
      'provider  sandbox  imagem                decorrido',
      '─'.repeat(50),
      'cursor    docker   choliba-agent:latest  00:01:42',
    ]);
  });

  it('draws the header cells with the strong style, padding outside it', () => {
    const [head] = RUN.render(80, { strong: (text) => `*${text}*` });

    expect(head).toBe('*provider*  *sandbox*  *imagem*                *decorrido*');
  });

  it('shrinks the columns marked first, cutting with …, and shows the abbr of a header that no longer fits', () => {
    const table = new Table({
      cols: [{}, {}, { shrink: true, minWidth: 6 }, { minWidth: 5 }],
      head: [[th('provider'), th('sandbox'), th('imagem'), th('decorrido', { abbr: 'tempo' })]],
      bodies: [[[td('cursor'), td('docker'), td('choliba-agent:latest'), td('00:01:42')]]],
    });

    expect(table.render(40)).toEqual([
      'provider  sandbox  imagem      decorrido',
      '─'.repeat(40),
      'cursor    docker   choliba-a…  00:01:42',
    ]);
    expect(table.render(30)).toEqual([
      'provi…  sandb…  imagem  tempo',
      '─'.repeat(30),
      'cursor  docker  choli…  00:01…',
    ]);
  });

  it('draws column rules, crossing the horizontal ones, and counts them in the width', () => {
    const head = [[th('provider'), th('modelo')]];
    const bodies = [[[td('cursor'), td('Auto')]], [[td('claude'), td('sonnet')]]];

    expect(new Table({ rules: 'all', head, bodies }).render(80)).toEqual([
      'provider │ modelo',
      '─────────┼───────',
      'cursor   │ Auto',
      '─────────┼───────',
      'claude   │ sonnet',
    ]);
    expect(new Table({ rules: 'cols', head, bodies }).render(80)).toEqual([
      'provider │ modelo',
      'cursor   │ Auto',
      'claude   │ sonnet',
    ]);
    const narrow = new Table({ rules: 'cols', cols: [{}, { shrink: true, minWidth: 3 }], head, bodies });
    expect(narrow.fits(14)).toBe(true);
    expect(narrow.render(14)).toEqual(['provider │ mo…', 'cursor   │ Au…', 'claude   │ so…']);
    expect(narrow.fits(13)).toBe(false);
  });

  it('fits a width only cutting the columns marked to shrink', () => {
    const table = new Table({
      cols: [{}, { shrink: true, minWidth: 3 }],
      bodies: [[[td('provider'), td('choliba-agent:latest')]]],
    });

    expect(table.fits(80)).toBe(true);
    expect(table.fits(20)).toBe(true);
    expect(table.fits(12)).toBe(false);
  });

  it('aligns each column as its col says, and spans cells across columns', () => {
    const table = new Table({
      cols: [{ span: 2 }, { align: 'right' }],
      bodies: [
        [
          [td('a'), td('b'), td('1')],
          [td('bb'), td('c'), td('22')],
        ],
      ],
      foot: [[th('total', { colspan: 2 }), td('23')]],
    });

    expect(table.render(80)).toEqual(['a   b   1', 'bb  c  22', '─────────', 'total  23']);
  });

  it('centers, grows the last column a spanning cell covers, and leaves missing cells blank', () => {
    const table = new Table({
      cols: [{ align: 'center' }, {}],
      rules: 'rows',
      head: [[th('coluna'), th('y')]],
      bodies: [[[td('x'), td('y')], [td('uma célula longa', { colspan: 2 })], [td('só')]]],
    });

    const rule = '─'.repeat(16);
    expect(table.render(80)).toEqual(['coluna  y', rule, '  x     y', rule, 'uma célula longa', rule, '  só']);
  });

  it('puts the caption first, cut to the width, and draws no rule with rules none', () => {
    const table = new Table({
      caption: 'Execução em andamento',
      rules: 'none',
      head: [[th('a')]],
      bodies: [[[td('b')]], [[td('c')]]],
    });

    expect(table.render(10)).toEqual(['Execução …', 'a', 'b', 'c']);
    expect(table.render(0)[0]).toBe('');
  });

  it('counts an accented letter as one column', () => {
    const table = new Table({ bodies: [[[td('é'), td('x')]]] });

    expect(table.render(80)).toEqual(['é  x']);
  });

  it('renders nothing for an empty table, and stays at the minimums when the width is too small', () => {
    expect(new Table({}).render(80)).toEqual([]);
    expect(new Table({ bodies: [[[td('abc'), td('def')]]] }).render(2)).toEqual(['…  …']);
  });

  it('refuses rowspan and a colspan that is not a positive integer', () => {
    expect(() => td('x', { rowspan: 2 })).toThrow(TableError);
    expect(() => td('x', { rowspan: 2 })).toThrow('rowspan não é suportado na tabela do terminal (célula "x").');
    expect(() => th('x', { colspan: 0 })).toThrow('colspan precisa ser um inteiro maior que zero (célula "x").');
    expect(() => td('x', { colspan: 1.5 })).toThrow(TableError);
    expect(td('x', { rowspan: 1 }).colspan).toBe(1);
  });
});
