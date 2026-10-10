import * as runner from '../index';

describe.each([['@choliba/runner', runner]])('%s', (_name, barrel) => {
  it('exports only defined values', () => {
    for (const [name, value] of Object.entries(barrel)) {
      expect([name, value]).toEqual([name, expect.anything()]);
    }
  });
});
