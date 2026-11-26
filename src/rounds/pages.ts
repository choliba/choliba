/**
 * The rounds' pages, served: the built pages (src/rounds/web/dist, shipped in the
 * package), the records of the configured `rounds.data`, as one JSON
 * (`rounds.json`) the pages read when they open, and the files of
 * `rounds.definitions` (`definitions.json`), for opening a round in "Criar
 * rodada". In this repository, during development, Vite serves the pages and
 * the same payloads (payload.ts).
 */

import { UsageError } from '../errors';
import {
  extname,
  isWithin,
  join,
  pathExists,
  readText,
  resolve,
} from '../filesystem/index';
import { ROUNDS_DEFINITIONS_JSON, ROUNDS_JSON } from './constants';
import { definitionsPayload, roundsPayload } from './payload';

/** The media types the built pages use. */
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export interface PagesServer {
  readonly url: string;
  stop(): Promise<void>;
}

/**
 * Serves the built pages from `dist`, the records of `data` and the files of
 * `definitions`, on `localhost:<port>`. A path outside `dist` is not served.
 */
export function servePages({
  dist,
  data,
  definitions,
  port,
}: {
  readonly dist: string;
  readonly data: string;
  readonly definitions: string;
  readonly port: number;
}): PagesServer {
  if (!pathExists(join(dist, 'index.html'))) {
    throw new UsageError(
      `As páginas das rodadas não foram geradas em ${dist}. Instale o Choliba pelo .tgz da release, que já as traz; no repositório do Choliba, rode bun run rounds:build.`,
    );
  }
  const server = Bun.serve({
    hostname: 'localhost',
    port,
    fetch: (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname);
      if (path === `/${ROUNDS_JSON}`) {
        return new Response(roundsPayload(data), {
          headers: { 'content-type': TYPES['.json'] ?? '' },
        });
      }
      if (path === `/${ROUNDS_DEFINITIONS_JSON}`) {
        return new Response(definitionsPayload(definitions), {
          headers: { 'content-type': TYPES['.json'] ?? '' },
        });
      }
      const file = resolve(dist, `.${path === '/' ? '/index.html' : path}`);
      if (!isWithin(file, dist) || !pathExists(file)) {
        return new Response('Não encontrado.', { status: 404 });
      }
      return new Response(readText(file), {
        headers: {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        },
      });
    },
  });
  return {
    url: `http://localhost:${String(server.port)}/`,
    stop: async () => {
      await server.stop(true);
    },
  };
}
