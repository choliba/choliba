/**
 * A raiz da pasta de trabalho no `agent.yaml` (`${CHOL_ROOT}`): sempre descoberta pelo choliba (a pasta cujo
 * `package.json` depende dele), nunca lida do `.env` nem do ambiente.
 */
export const CHOL_ROOT = 'CHOL_ROOT';

/** Nome da variável de ambiente para o provider padrão do CLI de agentes. */
export const CHOL_AGENTS_PROVIDER = 'CHOL_AGENTS_PROVIDER';

/** Nome da variável de ambiente para o diretório de definições de agentes. */
export const CHOL_AGENTS_DIR = 'CHOL_AGENTS_DIR';

/** Nome da variável de ambiente para o diretório das skills que os agentes podem usar. */
export const CHOL_SKILLS_DIR = 'CHOL_SKILLS_DIR';

/** Nome da variável de ambiente para o diretório dos servidores MCP que os agentes podem usar. */
export const CHOL_MCPS_DIR = 'CHOL_MCPS_DIR';

/** External workspace root (artifacts and, by default, projects under test). */
export const CHOL_GLOBAL_DIR = 'CHOL_GLOBAL_DIR';

/** Override for the projects folder when it is not `{CHOL_GLOBAL_DIR}/projects`. */
export const CHOL_PROJECTS_DIR = 'CHOL_PROJECTS_DIR';

/** Optional ticket-runs/ root when different from CHOL_PROJECTS_DIR. */
export const CHOL_TICKET_RUNS = 'CHOL_TICKET_RUNS';

/** Where `choliba playwright-cli` writes the files it names itself (default `.cache/playwright-cli`). */
export const CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR = 'CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR';

/** The colors chosen for the workspace: `papel.nome=cor`, separated by commas (`agents.test-writer=red`). */
export const CHOL_COLORS = 'CHOL_COLORS';
