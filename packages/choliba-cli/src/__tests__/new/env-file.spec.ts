import { setEnvValue } from '../../new/env-file';

describe('setEnvValue', () => {
  it('fills the line the template brings commented, or the one already set', () => {
    expect(setEnvValue('A=1\n# CHOL_AGENTS_PROVIDER=auto\nB=2\n', 'CHOL_AGENTS_PROVIDER', 'claude')).toBe(
      'A=1\nCHOL_AGENTS_PROVIDER=claude\nB=2\n',
    );
    expect(setEnvValue('CHOL_MCP_APP_DIR=/old\n', 'CHOL_MCP_APP_DIR', '/new')).toBe('CHOL_MCP_APP_DIR=/new\n');
  });

  it('adds the line at the end when there is none', () => {
    expect(setEnvValue('A=1', 'K', 'v')).toBe('A=1\nK=v\n');
    expect(setEnvValue('A=1\n\n\n', 'K', 'v')).toBe('A=1\nK=v\n');
    expect(setEnvValue('', 'K', 'v')).toBe('K=v\n');
  });
});
