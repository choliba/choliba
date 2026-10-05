import * as projects from '../index';
import * as nest from '../nest';

describe.each([
  ['@choliba/projects', projects],
  ['@choliba/projects/nest', nest],
])('%s', (_name, barrel) => {
  it('exports only defined values', () => {
    for (const [name, value] of Object.entries(barrel)) {
      expect([name, value]).toEqual([name, expect.anything()]);
    }
  });
});
