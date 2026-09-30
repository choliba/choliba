/**
 * Os nomes dos arquivos que o choliba lê e grava: a única fonte deles. Um nome que precisa mudar muda aqui,
 * e todo pacote que o usa importa daqui.
 */

/** A declaração de um agente, em `<pasta dos agentes>/<id>/`. */
export const AGENT_FILE = 'agent.yaml';

/** A descrição de uma skill, em `<pasta das skills>/<nome>/`. */
export const SKILL_FILE = 'SKILL.md';

/** A configuração da pasta de trabalho, na raiz dela. */
export const ENV_FILE = '.env';

/** O manifesto de um pacote; o da pasta de trabalho depende de choliba. */
export const PACKAGE_FILE = 'package.json';

/** A configuração de um projeto de teste (ambientes, dispositivos). */
export const PROJECT_CONFIG_FILE = 'config.json';

/** As credenciais de um projeto de teste, por ambiente. */
export const PROJECT_ENV_FILE = '.env.json';

/** O modelo das credenciais de um projeto de teste, a partir do qual o `.env.json` é criado. */
export const PROJECT_ENV_EXAMPLE_FILE = '.env.example.json';

/** Os arquivos que o `choliba setup` grava numa pasta de trabalho nova, além do `.env`. */
export const ENV_EXAMPLE_FILE = '.env.example';
export const GITIGNORE_FILE = '.gitignore';
export const BUNFIG_FILE = 'bunfig.toml';
export const PRETTIERRC_FILE = '.prettierrc.json';
export const PRETTIERIGNORE_FILE = '.prettierignore';
export const ESLINT_CONFIG_FILE = 'eslint.config.mjs';
export const EDITORCONFIG_FILE = '.editorconfig';
