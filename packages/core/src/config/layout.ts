import { join } from 'node:path';

/**
 * As pastas da pasta de trabalho e de um projeto: a única fonte delas. Os caminhos são relativos (à raiz da
 * pasta de trabalho, de um projeto ou de uma origem de `choliba install`).
 */

/** Onde ficam as aplicações testadas e os agentes do choliba (`app/agents`, `app/.agents/*`). */
export const APP_DIR = 'app';

/** Os agentes, em qualquer raiz que os tenha (a pasta da aplicação, uma origem de `choliba install`). */
export const AGENTS_SUBDIR = 'agents';

/** As skills, ao lado dos agentes. */
export const SKILLS_SUBDIR = join('.agents', 'skills');

/** Os servidores MCP, ao lado dos agentes. */
export const MCPS_SUBDIR = join('.agents', 'mcps');

/** Default subdirectory of GLOBAL_DIR where projects live. */
export const PROJECTS_SUBDIR = 'projects';

/** Os tickets de um projeto. */
export const TICKETS_SUBDIR = 'tickets';

/** Os specs de um projeto. */
export const TESTS_SUBDIR = 'tests';

/** Os resultados das execuções de cada ticket, por projeto. */
export const TICKET_RUNS_SUBDIR = 'ticket-runs';

/** Arquivos que o choliba gera e apaga, fora do controle de versão. */
export const CACHE_DIR = '.cache';

/** A pasta vazia de cada execução de agente. */
export const RUNS_DIR = join(CACHE_DIR, 'runs');

/** Os artefatos das execuções (o `GLOBAL_DIR` de uma pasta de trabalho nova). */
export const ARTIFACTS_DIR = join(CACHE_DIR, 'choliba');
