import { CONFIG_KEYS } from '@choliba/core';

import { AUTO } from '../../common/provider-registry';
import { DEFAULT_PLAYWRIGHT_OUTPUT_DIR } from '../../common/run-tools/playwright-tool';
import { DEFAULT_OLLAMA_URL } from '../../providers/claude/claude-ollama-agent.provider';
import { PROVIDERS_WITH_OLLAMA } from '../helpers/providers';

function key(name: string) {
  const found = CONFIG_KEYS.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
}

describe('the configuration registry', () => {
  it("names the agents' own defaults and the providers they take", () => {
    expect(key('CHOL_AGENTS_PROVIDER').fallback).toBe(AUTO);
    expect(key('CHOL_AGENTS_PROVIDER').values).toEqual(PROVIDERS_WITH_OLLAMA.choices());
    expect(key('CHOL_OLLAMA_URL').fallback).toBe(DEFAULT_OLLAMA_URL);
    expect(key('CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR').fallback).toBe(DEFAULT_PLAYWRIGHT_OUTPUT_DIR);
  });
});
