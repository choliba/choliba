import { env } from '../src/config/index';

/** The CLIs' credentials, from the .env; unset, the CLI uses its own login. */
export const securityConfig = {
  cursorApiKey: env.string('CHOLIBA_CURSOR_API_KEY'),
  claudeCodeOauthToken: env.string('CHOLIBA_CLAUDE_CODE_OAUTH_TOKEN'),
};
