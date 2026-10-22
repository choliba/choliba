import { envSource } from '@choliba/config';
import { DEFAULT_OLLAMA_URL } from '@choliba/providers';

import { agentsConfig } from '../../agents/agents-config';
import { AUTO } from '../../common/provider-registry';
import { DEFAULT_PLAYWRIGHT_OUTPUT_DIR } from '../../common/run-tools/playwright-tool';
import { PROVIDERS_WITH_OLLAMA } from '../helpers/providers';

describe('agentsConfig', () => {
  it("names the agents' own defaults and the providers they take", () => {
    const config = agentsConfig.read([envSource({})]);

    expect(config.provider).toBe(AUTO);
    expect(agentsConfig.keys.find((key) => key.address.env === 'CHOL_AGENTS_PROVIDER')?.values).toEqual(
      PROVIDERS_WITH_OLLAMA.choices(),
    );
    expect(config.ollamaUrl).toBe(DEFAULT_OLLAMA_URL);
    expect(config.playwrightOutputDir).toBe(DEFAULT_PLAYWRIGHT_OUTPUT_DIR);
  });

  it('marks credentials as secrets', () => {
    const secrets = agentsConfig.keys.filter((key) => key.secret).map((key) => key.address.env);

    expect(secrets).toEqual(['CLAUDE_CODE_OAUTH_TOKEN', 'CURSOR_API_KEY']);
  });
});
