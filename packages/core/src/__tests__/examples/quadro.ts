import { frameBottom, frameLines, frameTop } from '../../index';

/** `texto` num quadro de `largura` colunas, com `titulo` em cima. */
export function quadro(titulo: string, texto: string, largura: number): string {
  return [frameTop(titulo, largura), ...frameLines(texto, largura), frameBottom(largura)].join('\n');
}
