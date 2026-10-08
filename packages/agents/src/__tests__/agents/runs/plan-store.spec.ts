import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  formatPlanTimestamp,
  planBasename,
  readPlan,
  resolvePlanPath,
  slugify,
  writePlan,
} from '../../../agents/runs/plan-store';
import { makeTmpDir } from '../../helpers/tmp';

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics with a single dash', () => {
    expect(slugify('Update the README file!')).toBe('update-the-readme-file');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --weird task--  ')).toBe('weird-task');
  });

  it('truncates to maxLen', () => {
    expect(slugify('a'.repeat(70))).toHaveLength(60);
  });

  it('drops a dangling trailing dash left by the cut', () => {
    // "ab cd ef" -> "ab-cd-ef"; slicing at 3 lands exactly on the dash after "ab".
    expect(slugify('ab cd ef', 3)).toBe('ab');
  });

  it('falls back to "plan" when nothing alphanumeric survives', () => {
    expect(slugify('!!!')).toBe('plan');
    expect(slugify('')).toBe('plan');
  });
});

describe('formatPlanTimestamp', () => {
  it('formats ISO time with colons replaced for filesystem safety', () => {
    expect(formatPlanTimestamp(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00-00-00Z');
  });
});

describe('planBasename', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('is {timestamp}-{provider}.{nome}', () => {
    expect(planBasename('claude', 'fix the bug', now)).toBe('2026-01-01T00-00-00Z-claude.fix-the-bug');
    expect(planBasename('cursor', 'plan it', now)).toBe('2026-01-01T00-00-00Z-cursor.plan-it');
  });
});

describe('resolvePlanPath', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('resolves to <plansDir>/<agent>/{timestamp}-{provider}.{nome}.md when nothing exists yet', () => {
    const tmp = makeTmpDir('plan-path');
    try {
      expect(resolvePlanPath(tmp.path, 'developer', 'fix the bug', 'claude', now)).toBe(
        join(tmp.path, 'developer', '2026-01-01T00-00-00Z-claude.fix-the-bug.md'),
      );
    } finally {
      tmp.cleanup();
    }
  });

  it('appends -2, -3, ... when the basename is already taken', () => {
    const tmp = makeTmpDir('plan-path-collision');
    try {
      const dir = join(tmp.path, 'developer');
      const base = '2026-01-01T00-00-00Z-claude.fix-the-bug';
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${base}.md`), '');
      writeFileSync(join(dir, `${base}-2.md`), '');

      expect(resolvePlanPath(tmp.path, 'developer', 'fix the bug', 'claude', now)).toBe(join(dir, `${base}-3.md`));
    } finally {
      tmp.cleanup();
    }
  });
});

describe('writePlan and readPlan', () => {
  it('writes YAML frontmatter, and readPlan strips it back off', () => {
    const tmp = makeTmpDir('plan-write');
    try {
      const now = new Date('2026-01-01T00:00:00.000Z');

      const path = writePlan({
        plansDir: tmp.path,
        agent: 'developer',
        command: 'developer',
        provider: 'claude',
        task: 'fix the bug',
        content: '1. do x\n2. do y',
        now,
      });

      expect(existsSync(path)).toBe(true);
      const raw = readFileSync(path, 'utf8');
      expect(raw).toContain('agente: developer');
      expect(raw).toContain('comando: developer');
      expect(raw).toContain('provider: claude');
      expect(raw).toContain('tarefa: "fix the bug"');
      expect(raw).toContain('geradoEm: 2026-01-01T00:00:00.000Z');
      expect(raw).toContain('1. do x\n2. do y');

      expect(readPlan(path)).toBe('1. do x\n2. do y');
    } finally {
      tmp.cleanup();
    }
  });

  it('readPlan returns the trimmed content as-is when there is no frontmatter', () => {
    const tmp = makeTmpDir('plan-no-frontmatter');
    try {
      const path = join(tmp.path, 'plain.md');
      mkdirSync(tmp.path, { recursive: true });
      writeFileSync(path, '  just text  \n');

      expect(readPlan(path)).toBe('just text');
    } finally {
      tmp.cleanup();
    }
  });

  it('readPlan handles frontmatter with no closing delimiter by returning the whole trimmed text', () => {
    const tmp = makeTmpDir('plan-broken-frontmatter');
    try {
      const path = join(tmp.path, 'broken.md');
      mkdirSync(tmp.path, { recursive: true });
      writeFileSync(path, '---\nagente: x\nno closing delimiter');

      expect(readPlan(path)).toBe('---\nagente: x\nno closing delimiter');
    } finally {
      tmp.cleanup();
    }
  });
});
