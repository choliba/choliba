import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Lowercases, keeps only `[a-z0-9]`, collapses everything else to a single `-`, and trims it. */
export function slugify(task: string, maxLen = 60): string {
  const slug = task
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replaceAll(/-+$/g, '');
  return slug === '' ? 'plan' : slug;
}

/** ISO timestamp safe for plan filenames, e.g. `2026-01-01T00-00-00Z`. */
export function formatPlanTimestamp(now: Date): string {
  return `${now.toISOString().slice(0, 19).replaceAll(':', '-')}Z`;
}

/** `{timestamp}-{provider}.{nome}` basename shared by resolvePlanPath and writePlan. */
export function planBasename(provider: string, task: string, now: Date): string {
  return `${formatPlanTimestamp(now)}-${provider}.${slugify(task)}`;
}

/**
 * `<plansDir>/<agent>/{timestamp}-{provider}.{nome}.md`, with `-2`, `-3`, ... before `.md`
 * when that basename already exists — plans are never overwritten silently.
 */
export function resolvePlanPath(plansDir: string, agent: string, task: string, provider: string, now: Date): string {
  const dir = join(plansDir, agent);
  const base = planBasename(provider, task, now);
  let candidate = join(dir, `${base}.md`);
  let attempt = 2;
  while (existsSync(candidate)) {
    candidate = join(dir, `${base}-${String(attempt)}.md`);
    attempt += 1;
  }
  return candidate;
}

export interface WritePlanOptions {
  readonly plansDir: string;
  readonly agent: string;
  readonly command: string;
  readonly provider: string;
  readonly task: string;
  readonly content: string;
  readonly now: Date;
}

/** Writes a plan file with YAML frontmatter, and returns the path written. */
export function writePlan(options: WritePlanOptions): string {
  const path = resolvePlanPath(options.plansDir, options.agent, options.task, options.provider, options.now);
  const frontmatter = [
    '---',
    `agente: ${options.agent}`,
    `comando: ${options.command}`,
    `provider: ${options.provider}`,
    `tarefa: ${JSON.stringify(options.task)}`,
    `geradoEm: ${options.now.toISOString()}`,
    '---',
    '',
  ].join('\n');

  mkdirSync(join(options.plansDir, options.agent), { recursive: true });
  writeFileSync(path, `${frontmatter}\n${options.content}\n`, 'utf8');
  return path;
}

/** Reads a plan file back, stripping its leading `--- ... ---` frontmatter block if present. */
export function readPlan(path: string): string {
  const text = readFileSync(path, 'utf8');
  if (!text.startsWith('---\n')) {
    return text.trim();
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    return text.trim();
  }
  return text.slice(end + '\n---\n'.length).trim();
}
