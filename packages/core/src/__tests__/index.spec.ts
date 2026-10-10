import * as core from '..';

describe('@choliba/core', () => {
  it('exports only defined values', () => {
    const exported = Object.entries(core);

    expect(exported.length).toBeGreaterThan(0);
    for (const [name, value] of exported) {
      expect([name, value]).toEqual([name, expect.anything()]);
    }
  });
});
