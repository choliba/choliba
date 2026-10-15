import { takeGlobalFlags } from '../../index';

/** A linha de comando sem o `--no-color`, e se ele estava lá. */
export function lerLinha(argv: readonly string[]): string {
  const { argv: resto, noColorFlag } = takeGlobalFlags(argv);
  return `${resto.join(' ')} (cor: ${noColorFlag ? 'não' : 'sim'})`;
}
