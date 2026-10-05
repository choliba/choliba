import * as cli from '../cli';
import * as config from '../config';
import * as platform from '../platform';
import * as nest from '../nest';
import * as theme from '../theme';

describe.each([
  ['@choliba/core/cli', cli],
  ['@choliba/core/config', config],
  ['@choliba/core/platform', platform],
  ['@choliba/core/theme', theme],
  ['@choliba/core/nest', nest],
])('%s', (_name, barrel) => {
  it('exports only defined values', () => {
    const exported = Object.entries(barrel);

    expect(exported.length).toBeGreaterThan(0);
    for (const [name, value] of exported) {
      expect([name, value]).toEqual([name, expect.anything()]);
    }
  });
});
