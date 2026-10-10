import * as projects from '../index';

describe('@choliba/projects', () => {
  it('exports only defined values', () => {
    for (const [name, value] of Object.entries(projects)) {
      expect([name, value]).toEqual([name, expect.anything()]);
    }
  });
});
