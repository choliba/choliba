import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

import { findResource, findWorkspaceRoot } from '@choliba/core/config';

import { COMPLETION_BASH } from './completion';

/** Where `setup` keeps the completion script: one place for every workspace. */
export function completionFile(home: string): string {
  return join(home, '.local', 'share', 'choliba', 'completion.bash');
}

/** The ~/.bashrc line that loads it; checking the file first keeps a new terminal quiet if it is ever removed. */
export function sourceLine(home: string): string {
  const file = completionFile(home);
  return `if [ -f "${file}" ]; then source "${file}"; fi`;
}

/** What to do after installing: shown by `setup` (the postinstall), and enough to get going. */
export const NEXT_STEPS = [
  'Próximos passos:',
  '  1. crie um projeto: bunx choliba projects create-project --app-dir <pasta da aplicação> --base-url <url>',
  '  2. ponha seus agentes em agents/<nome>/, skills em .agents/skills/<nome>/ e MCPs em .agents/mcps/<nome>.json',
  '  3. bunx choliba --help (os projetos ficam em projects/; para outro lugar, mude GLOBAL_DIR no .env)',
].join('\n');

/** `templates/workspace/` of this package: the starting `.env` and `.gitignore` of a workspace. */
export function workspaceTemplatesDir(): string {
  return findResource(join('templates', 'workspace'), __dirname);
}

/** The folders a workspace has, each kept by a `.gitkeep` while empty; `projects` is where GLOBAL_DIR points at first. */
const WORKSPACE_DIRS = ['agents', join('.agents', 'skills'), join('.agents', 'mcps'), 'projects'];

/** Template file → workspace file (npm drops files named `.gitignore` from packages, hence no dot). */
const WORKSPACE_FILES: readonly (readonly [string, string])[] = [
  ['env', '.env.example'],
  ['gitignore', '.gitignore'],
];

/**
 * The `.env` of a new workspace: `.env.example` with GLOBAL_DIR set to the workspace itself, so projects
 * go to its `projects/` and every command works right after installing.
 */
export function initialEnv(example: string, root: string): string {
  return example.replace(/^GLOBAL_DIR=.*$/m, `GLOBAL_DIR=${root}`);
}

/**
 * The folders and files a workspace needs, created where missing — never overwriting what is there.
 * Returns what was created, relative to `root`.
 */
export function scaffoldWorkspace(root: string, templatesDir: string = workspaceTemplatesDir()): readonly string[] {
  const created: string[] = [];
  for (const dir of WORKSPACE_DIRS) {
    if (!existsSync(join(root, dir))) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, '.gitkeep'), '');
      created.push(`${dir}/`);
    }
  }
  for (const [template, file] of WORKSPACE_FILES) {
    if (!existsSync(join(root, file))) {
      copyFileSync(join(templatesDir, template), join(root, file));
      created.push(file);
    }
  }
  if (!existsSync(join(root, '.env'))) {
    writeFileSync(join(root, '.env'), initialEnv(readFileSync(join(templatesDir, 'env'), 'utf8'), root));
    created.push('.env');
  }
  return created;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lists choliba in the workspace package.json `trustedDependencies`, so Bun runs this setup on every
 * later install or upgrade instead of blocking it. Returns whether the file changed; a missing or
 * unreadable package.json is left alone.
 */
export function trustPackage(root: string): boolean {
  const file = join(root, 'package.json');
  if (!existsSync(file)) return false;
  let pkg: unknown;
  try {
    pkg = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
  if (!isRecord(pkg)) return false;
  const current = pkg['trustedDependencies'];
  const trusted = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string') : [];
  if (trusted.includes('choliba')) return false;
  writeFileSync(file, `${JSON.stringify({ ...pkg, trustedDependencies: [...trusted, 'choliba'] }, null, 2)}\n`);
  return true;
}

/**
 * The workspace `setup` works on: the one `cwd` is in or, during the postinstall (which runs inside
 * `node_modules/choliba`, possibly before package.json lists choliba), the folder of that node_modules.
 */
export function setupWorkspace(cwd: string): string {
  try {
    return findWorkspaceRoot(cwd);
  } catch (error) {
    const marker = `${sep}node_modules${sep}`;
    const index = `${cwd}${sep}`.indexOf(marker);
    if (index === -1) throw error;
    return cwd.slice(0, index);
  }
}

/**
 * Turns bash completion on: writes the script (always, so an upgrade refreshes it) and adds the
 * line that loads it to ~/.bashrc, once. Returns how it went.
 */
export function setupShell(home: string): string {
  const file = completionFile(home);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, COMPLETION_BASH);

  const bashrc = join(home, '.bashrc');
  const line = sourceLine(home);
  // Any line mentioning the script counts, so a line written by an older setup is not duplicated.
  const present = existsSync(bashrc) && readFileSync(bashrc, 'utf8').includes(file);
  if (!present) {
    appendFileSync(bashrc, `\n# Autocomplete do choliba\n${line}\n`);
  }
  const status = present ? 'já estava ligado' : 'ligado';
  return `Autocomplete ${status} no ~/.bashrc: abra um terminal novo (ou rode \`source ~/.bashrc\`).`;
}

/** `choliba setup`, also the postinstall: the workspace structure, bash completion and what to do next. */
export function setup(home: string, cwd: string, templatesDir: string = workspaceTemplatesDir()): string {
  const root = setupWorkspace(cwd);
  const created = [
    ...scaffoldWorkspace(root, templatesDir),
    ...(trustPackage(root) ? ['trustedDependencies no package.json'] : []),
  ];
  const structure =
    created.length === 0
      ? `Pasta de trabalho: ${root} (já estava pronta).`
      : `Pasta de trabalho: ${root}\n  criado: ${created.join(', ')}`;
  return ['choliba instalado.', '', structure, setupShell(home), '', NEXT_STEPS].join('\n');
}
