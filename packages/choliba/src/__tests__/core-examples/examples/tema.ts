import { colorEnabled, paintAnsi } from '../../../../scripts/entries/core';

/** `texto` em verde quando a saída aceita cor, e sem códigos de escape quando não aceita. */
export function emVerde(texto: string, env: Readonly<Record<string, string | undefined>>, isTTY: boolean): string {
  const comCor = colorEnabled({ env, isTTY, noColorFlag: false });
  return comCor ? paintAnsi('green', texto) : texto;
}
