import { expandVars, mcpConfig, pathPolicy, readAgentPermissions, validateAgentYamlV1 } from '../..';

describe('@choliba/domain agent rules', () => {
  it('exposes pure variable, MCP and permission rules through its entry', () => {
    expect(expandVars('${ROOT}/app', { ROOT: '/work' })).toEqual({ text: '/work/app', missing: [] });
    expect(mcpConfig('{"url":"https://mcp.example"}', 'mcp.json')).toEqual({ url: 'https://mcp.example' });
    expect(pathPolicy(readAgentPermissions({ allow: { read: ['/work/'] } })).read.allow).toEqual(['/work/']);
    expect(readAgentPermissions({ allow: { read: ['/work/', 1] } }).allowRead).toEqual([]);
  });

  it('validates YAML text without reading an agent file', () => {
    expect(validateAgentYamlV1('version: 2', 'echo')).toEqual({
      valid: false,
      errors: ['padrão 2 não suportado; suportados: 1'],
    });
  });
});
