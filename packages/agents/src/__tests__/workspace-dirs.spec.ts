import { join } from 'node:path';

import { definedConfig, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '../index';

describe('workspace dirs', () => {
  it('default to .choliba/agents, .choliba/skills and .choliba/mcps, the layout choliba setup makes', () => {
    expect(resolveAgentsDir(undefined, {}, '/w')).toBe(join('/w', '.choliba', 'agents'));
    expect(resolveSkillsDir({}, '/w')).toBe(join('/w', '.choliba', 'skills'));
    expect(resolveMcpsDir({}, '/w')).toBe(join('/w', '.choliba', 'mcps'));
  });

  it('take the flag or the config, relative to the workspace root or absolute', () => {
    expect(resolveAgentsDir('meus', { CHOL_AGENTS_DIR: '/x' }, '/w')).toBe(join('/w', 'meus'));
    expect(resolveAgentsDir(undefined, { CHOL_AGENTS_DIR: '/x' }, '/w')).toBe('/x');
    expect(resolveSkillsDir({ CHOL_SKILLS_DIR: 'sk' }, '/w')).toBe(join('/w', 'sk'));
    expect(resolveMcpsDir({ CHOL_MCPS_DIR: '/m' }, '/w')).toBe('/m');
  });

  it('keep only the config entries that have a value', () => {
    expect(definedConfig({ A: 'a', B: undefined })).toEqual({ A: 'a' });
  });
});
