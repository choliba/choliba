import { defineConfig } from '@choliba/config';
import { DEFAULT_AGENTS_DIR, DEFAULT_MCPS_DIR, DEFAULT_SKILLS_DIR } from './agent-layout';

/** The agents group's keys: providers, their files and the tools a run offers. */
export const agentsConfig = defineConfig('agents', {
  provider: {
    env: 'CHOL_AGENTS_PROVIDER',
    type: 'string',
    description: 'provider padrão dos agentes',
    values: ['auto', 'claude', 'claude-ollama', 'codex', 'cursor'],
    default: 'auto',
  },
  ollamaUrl: {
    env: 'CHOL_OLLAMA_URL',
    type: 'string',
    description: 'onde o provider claude-ollama encontra o Ollama',
    default: 'http://localhost:11434',
  },
  playwrightOutputDir: {
    env: 'CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR',
    type: 'string',
    description: 'onde a ferramenta playwright-cli grava os arquivos',
    default: '.cache/playwright-cli',
  },
  agentsDir: {
    env: 'CHOL_AGENTS_DIR',
    type: 'string',
    description: 'pasta dos agentes',
    default: DEFAULT_AGENTS_DIR,
  },
  skillsDir: {
    env: 'CHOL_SKILLS_DIR',
    type: 'string',
    description: 'pasta das skills',
    default: DEFAULT_SKILLS_DIR,
  },
  mcpsDir: {
    env: 'CHOL_MCPS_DIR',
    type: 'string',
    description: 'pasta dos MCPs',
    default: DEFAULT_MCPS_DIR,
  },
  claudeCodeOauthToken: {
    env: 'CLAUDE_CODE_OAUTH_TOKEN',
    type: 'string',
    description: 'token do provider claude',
    secret: true,
  },
  cursorApiKey: {
    env: 'CURSOR_API_KEY',
    type: 'string',
    description: 'chave do provider cursor',
    secret: true,
  },
});
