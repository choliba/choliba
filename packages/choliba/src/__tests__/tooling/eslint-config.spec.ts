import config from '../../tooling/eslint-config';

describe('choliba/eslint', () => {
  it('ignores what the tools generate, then applies the JavaScript and TypeScript recommended rules', () => {
    expect(config[0]?.ignores).toEqual(
      expect.arrayContaining(['**/node_modules/**', '.cache/**', '.playwright-cli/**', '**/ticket-runs/**']),
    );
    expect(config.length).toBeGreaterThan(2);
  });
});
