import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import { environment } from '../../execute/process.ts';
import { resolve } from '../../filesystem/index.ts';
import {
  ROUNDS_DATA_ENV,
  ROUNDS_DEFINITIONS_ENV,
  ROUNDS_DEFINITIONS_JSON,
  ROUNDS_JSON,
} from '../../rounds/constants.ts';
import { definitionsPayload, roundsPayload } from '../../rounds/payload.ts';

/**
 * Where the records are: `rounds.data`, given by `choliba rounds:web` when it
 * starts Vite. Unset only when Vite runs by itself (a build needs no records).
 */
const DATA = environment()[ROUNDS_DATA_ENV];

/** Where the declarations are: `rounds.definitions`, given the same way. */
const DEFINITIONS = environment()[ROUNDS_DEFINITIONS_ENV];

/**
 * The records as the pages fetch them when they open (`rounds.json`), the
 * same as the built pages get from `choliba rounds:web`. A record that comes
 * or goes reloads the pages: a round that just ran shows up at once. The
 * declarations' files (`definitions.json`) are read on each request.
 */
function records(): Plugin {
  return {
    name: 'rounds-records',
    configureServer(server) {
      if (DATA === undefined || DEFINITIONS === undefined) {
        throw new Error(
          `Sem ${ROUNDS_DATA_ENV} ou ${ROUNDS_DEFINITIONS_ENV}: sirva as páginas por bun run rounds:web, que passa o rounds.data e o rounds.definitions do choliba.config.ts.`,
        );
      }
      server.middlewares.use(
        `/${ROUNDS_DEFINITIONS_JSON}`,
        (_request, response) => {
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.end(definitionsPayload(DEFINITIONS));
        },
      );
      server.middlewares.use(`/${ROUNDS_JSON}`, (_request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.end(roundsPayload(DATA));
      });
      server.watcher.add(DATA);
      const reload = (file: string): void => {
        if (!resolve(file).startsWith(resolve(DATA))) return;
        if (!file.endsWith('.json')) return;
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('change', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

// The pages of the rounds: static, the records fetched when they open.
// `base: './'` keeps every path relative, so dist/ is served from anywhere.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), records()],
  build: { target: 'es2022' },
  server: {
    // The repository: the round types (src/rounds) and the tools (tools/).
    fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] },
  },
});
