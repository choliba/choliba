import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { definedConfig, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '../../agents/agent-dirs';

describe('workspace dirs', () => {
  it('default to .choliba/agents, .choliba/skills and .choliba/mcps, the layout choliba setup makes', () => {
    expect(resolveAgentsDir(undefined, {}, '/w')).toBe(join('/w', '.choliba', 'agents'));
    expect(resolveSkillsDir({}, '/w')).toBe(join('/w', '.choliba', 'skills'));
    expect(resolveMcpsDir({}, '/w')).toBe(join('/w', '.choliba', 'mcps'));
  });

  it('reads .agents in this repository and .choliba in an installed workspace', () => {
    const root = mkdtempSync(join(tmpdir(), 'choliba-dirs-'));
    try {
      expect(resolveAgentsDir(undefined, {}, root)).toBe(join(root, '.choliba', 'agents'));
      expect(resolveSkillsDir({}, root)).toBe(join(root, '.choliba', 'skills'));
      mkdirSync(join(root, '.agents', 'agents'), { recursive: true });
      expect(resolveAgentsDir(undefined, {}, root)).toBe(join(root, '.agents', 'agents'));
      expect(resolveSkillsDir({}, root)).toBe(join(root, '.agents', 'skills'));
      expect(resolveMcpsDir({}, root)).toBe(join(root, '.choliba', 'mcps'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
