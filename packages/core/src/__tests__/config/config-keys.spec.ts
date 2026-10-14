import { CONFIG_KEYS, configSettings, loadConfigFile } from '../../config/index';

function setting(name: string, settings: ReturnType<typeof configSettings>) {
  const found = settings.find((entry) => entry.key.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return { value: found.value, origin: found.origin };
}

describe('configSettings', () => {
  it('takes the environment over the .env over the default, and says where each value comes from', () => {
    const settings = configSettings(
      { CHOL_SANDBOX: 'docker', CHOL_NETWORK: 'host', CURSOR_API_KEY: 'segredo' },
      { CHOL_NETWORK: 'isolated', CHOL_COLORS: 'agents.po=red' },
    );

    expect(setting('CHOL_SANDBOX', settings)).toEqual({ value: 'docker', origin: '.env' });
    expect(setting('CHOL_NETWORK', settings)).toEqual({ value: 'isolated', origin: 'ambiente' });
    expect(setting('CHOL_COLORS', settings)).toEqual({ value: 'agents.po=red', origin: 'ambiente' });
    expect(setting('CHOL_AGENTS_PROVIDER', settings)).toEqual({ value: 'auto', origin: 'padrão' });
    expect(setting('CHOL_GLOBAL_DIR', settings)).toEqual({ value: undefined, origin: 'nenhum' });
    expect(setting('CURSOR_API_KEY', settings)).toEqual({ value: 'segredo', origin: '.env' });
  });

  it('works outside a workspace, with no .env', () => {
    expect(setting('CHOL_SANDBOX', configSettings(undefined, {}))).toEqual({ value: 'local', origin: 'padrão' });
  });

  it('names each key once, and marks only the credentials as secret', () => {
    const names = CONFIG_KEYS.map((key) => key.name);
    expect(new Set(names).size).toBe(names.length);
    expect(CONFIG_KEYS.filter((key) => key.secret).map((key) => key.name)).toEqual([
      'CLAUDE_CODE_OAUTH_TOKEN',
      'CURSOR_API_KEY',
    ]);
  });
});

describe('loadConfigFile', () => {
  it("parses the workspace's .env, and gives nothing without one", () => {
    expect(loadConfigFile('/w', () => 'CHOL_SANDBOX=docker\n# nota\n')).toEqual({ CHOL_SANDBOX: 'docker' });
    expect(loadConfigFile('/w', () => undefined)).toBeUndefined();
    expect(loadConfigFile('/nao-existe-mesmo')).toBeUndefined();
  });
});
