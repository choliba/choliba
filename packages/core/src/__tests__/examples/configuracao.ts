import { dotenv } from '@choliba/config';

const ARQUIVO = ['# A porta do servidor', 'PORTA=3000', 'NOME="Ana Maria"'].join('\n');

/** O arquivo lido, com o ambiente do processo vencendo o que ele diz. */
export function configuracao(
  env: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string | undefined>> {
  return { ...dotenv.parse(ARQUIVO, '.env'), ...env } as Readonly<Record<string, string | undefined>>;
}
