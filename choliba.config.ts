import { dirname, join } from './src/filesystem/index';
import { defineConfig } from './src/config';
import { pinoConfig, roundsConfig, appConfig, securityConfig } from './config';

// define diretórios
const dirRoot = dirname(__filename);
const dirStorage = join(dirRoot, 'storage');

// CHOLIBA_DEBUG=1 (ou true) liga o debug e o log em nível debug
const DEBUG = appConfig.debug;

export default defineConfig({
  debug: DEBUG,
  logger: {
    dir: join(dirStorage, 'logs'), // relativo a este arquivo
    // Trocar de pacote muda só esta função; erros têm log.level "error".
    use: pinoConfig({ debug: DEBUG }),
    logrotate: {
      maxFileSize: '50kb', // limite suave: o registro termina inteiro, o próximo vai para <sessão>.2.jsonl
      days: 1, // sessões mais antigas que isso são apagadas
      maxTotalSize: '100kb', // se a pasta passar disso, apaga das mais antigas
      compress: true, // true: as sessões encerradas viram .jsonl.gz
    },
  },
  database: {
    dir: join(dirStorage, 'db'), // relativo a este arquivo
    name: 'batata.db',
  },
  workspaces: {
    // A raiz padrão dos workspaces: a pasta onde o agente trabalha
    // (getConfig().workspaces.dir). O `bun run clear --workspaces` a esvazia.
    dir: join(dirStorage, 'workspaces'),
    // O home da CLI de cada workspace, um por raiz: sessões e histórico
    // (getConfig().workspaces.homes). O `bun run clear --homes` a esvazia.
    homes: join(dirStorage, 'homes'),
  },
  rounds: {
    // As suas rodadas ficam fora deste repositório, em ~/dev/minhas-rodadas:
    // as declarações, as fixtures e os registros. Rodando daqui, o Choliba usa
    // essas pastas (bun run rounds <id>, bun run rounds:web).
    // Onde as rodadas rodam: uma pasta por rodada (<dir>/<id>), recriada a
    // partir da fixture a cada execução. O `bun run clear --rounds` a esvazia.
    // As quatro pastas vêm do .env (CHOLIBA_ROUNDS_*). Sem elas a config
    // carrega igual, e só os comandos das rodadas param, dizendo o que falta.
    ...roundsConfig,
  },
  envs: [
    {
      // As credenciais dos CLIs: no .env com o prefixo, entregues a eles com
      // o nome que cada um lê (o env ativo entra no ambiente dos programas).
      CURSOR_API_KEY: securityConfig.cursorApiKey,
      CLAUDE_CODE_OAUTH_TOKEN: securityConfig.claudeCodeOauthToken,
    },
  ],
});
