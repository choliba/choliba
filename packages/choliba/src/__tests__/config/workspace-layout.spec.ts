import * as core from '@choliba/core';

import * as layout from '../../config/workspace-layout';

describe('workspace layout', () => {
  it('keeps the names core still exports while they move here', () => {
    const names = Object.keys(layout) as (keyof typeof layout)[];

    expect(names.map((name) => [name, layout[name]])).toEqual(names.map((name) => [name, core[name]]));
  });
});
