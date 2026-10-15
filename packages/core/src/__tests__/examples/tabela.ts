import { Table, td, th } from '../../index';

/** As idades numa tabela que cabe em `largura` colunas do terminal. */
export function tabelaDeIdades(largura: number): string {
  const tabela = new Table({
    cols: [{}, { align: 'right' }],
    head: [[th('Nome'), th('Idade')]],
    bodies: [
      [
        [td('Ana'), td('30')],
        [td('Bruno'), td('4')],
      ],
    ],
  });
  return tabela.render(largura).join('\n');
}
