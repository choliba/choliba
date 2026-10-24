import { definedConfig } from '../../common/defined-config';

describe('definedConfig', () => {
  it('keeps only the config entries that have a value', () => {
    expect(definedConfig({ A: 'a', B: undefined })).toEqual({ A: 'a' });
  });
});
