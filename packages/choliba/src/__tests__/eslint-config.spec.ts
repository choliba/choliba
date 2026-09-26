import config from '../eslint-config';

describe('choliba/eslint', () => {
  it('ignores what the tools generate, then applies the JavaScript and TypeScript recommended rules', () => {
    expect(config[0]?.ignores).toEqual(
      expect.arrayContaining(['**/node_modules/**', '.cache/**', '**/ticket-runs/**']),
    );
    expect(config.length).toBeGreaterThan(2);
  });
});
