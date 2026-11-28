import { hostname } from 'node:os';

import { ecsFormat } from '@elastic/ecs-pino-format';
import pino from 'pino';

import type { LoggerFactory } from '../src/config';
import { PRIVATE_FILE_MODE } from '../src/filesystem/constants';
import { join } from '../src/filesystem/index';

/** O destino do log: síncrono, criando a pasta, só o dono lê. */
const destination = (dest: string) =>
  pino.destination({ dest, sync: true, mkdir: true, mode: PRIVATE_FILE_MODE });

/**
 * O `logger.use` com pino e ECS. Recebe o `debug` de quem chama (o
 * choliba.config.ts): este arquivo é importado enquanto a configuração ainda
 * está carregando, e um getConfig() aqui leria os padrões, não o arquivo.
 */
export const pinoConfig =
  ({ debug }: { readonly debug: boolean }): LoggerFactory =>
  ({ dir, session, service }) =>
    pino(
      {
        ...ecsFormat({
          serviceName: service.name,
          serviceVersion: service.version,
        }),
        level: debug ? 'debug' : 'info',
        // Sem pid: process.* descreve o comando de cada evento.
        base: { hostname: hostname() },
      },
      destination(join(dir, `${session}.jsonl`)),
    );
