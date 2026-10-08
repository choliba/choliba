import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

import {
  APP_DIR,
  ARTIFACTS_DIR,
  BUNFIG_FILE,
  DEFAULT_AGENTS_DIR,
  DEFAULT_MCPS_DIR,
  DEFAULT_SKILLS_DIR,
  EDITORCONFIG_FILE,
  ENV_EXAMPLE_FILE,
  ENV_FILE,
  ESLINT_CONFIG_FILE,
  GITIGNORE_FILE,
  PACKAGE_FILE,
  PRETTIERIGNORE_FILE,
  PRETTIERRC_FILE,
  PROJECTS_SUBDIR,
  PROJECT_CONFIG_FILE,
  PROJECT_ENV_FILE,
  TESTS_SUBDIR,
  TICKETS_SUBDIR,
  findResource,
  findWorkspaceRoot,
} from '@choliba/core';
import { createProject, projectTemplatesDir } from '@choliba/projects';

import { COMPLETION_BASH } from '../completion/completion';

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
  '  1. rode o exemplo: bunx playwright install chromium (uma vez) e bun chol:tests exemplo',
  '  2. suas aplicações em app/<app>/, e um projeto de teste (em projects/) para cada uma:',
  '     bun chol:project:create --app-dir app/<app> --base-url <url>',
  '  3. instale agentes, skills e MCPs: bun chol:install <pasta, repositório git ou pacote npm> [--path agents/<nome>]',
  '     (vão para .choliba/agents/<nome>/, .choliba/skills/<nome>/ e .choliba/mcps/<nome>.json)',
  '  4. bun chol:check, bun chol:lint, bun chol:format e bun chol:help',
].join('\n');

/** `templates/workspace/` of this package: the starting files of a workspace. */
export function workspaceTemplatesDir(): string {
  return findResource(join('templates', 'workspace'), __dirname);
}

/** `templates/example/` of this package: the one-page example application and its test project. */
export function exampleTemplatesDir(): string {
  return findResource(join('templates', 'example'), __dirname);
}

/**
 * `app/` (`APP_DIR`) holds the applications being tested; `.choliba/` (`CHOLIBA_DIR`) holds choliba's agents
 * (`.choliba/agents`, `.choliba/skills`, `.choliba/mcps`) and theme; `projects/` holds the test projects. The
 * names come from `@choliba/core`.
 */

/** The folders a workspace has, each kept by a `.gitkeep` while empty. */
const WORKSPACE_DIRS = [DEFAULT_AGENTS_DIR, DEFAULT_SKILLS_DIR, DEFAULT_MCPS_DIR, PROJECTS_SUBDIR];

/** Template file → workspace file (packing drops `.gitignore`, `bunfig.toml` and dot files, hence other names). */
const WORKSPACE_FILES: readonly (readonly [string, string])[] = [
  ['env', ENV_EXAMPLE_FILE],
  ['gitignore', GITIGNORE_FILE],
  // `bun chol:…` without the "$ command" echo and the "script exited" lines, as in the choliba repository.
  ['bunfig', BUNFIG_FILE],
  // Width and indentation live here; Prettier reads them, so .prettierrc.json does not repeat them.
  ['editorconfig', EDITORCONFIG_FILE],
  ['prettierrc', PRETTIERRC_FILE],
  ['prettierignore', PRETTIERIGNORE_FILE],
  // .mjs: the workspace package.json has no "type", and the config is an ES module.
  ['eslint-config', ESLINT_CONFIG_FILE],
];

/**
 * The `.env` of a new workspace: `.env.example` with the test projects in `projects/` and the run
 * artifacts in `.cache/choliba`, both absolute (the runner resolves them from another folder).
 */
export function initialEnv(example: string, root: string): string {
  return example
    .replace(/^CHOL_GLOBAL_DIR=.*$/m, `CHOL_GLOBAL_DIR=${join(root, ARTIFACTS_DIR)}`)
    .replace(/^CHOL_PROJECTS_DIR=.*$/m, `CHOL_PROJECTS_DIR=${join(root, PROJECTS_SUBDIR)}`);
}

/** The example: the application `app/exemplo/` (one page and its README) and its test project `projects/exemplo/`. */
export const EXAMPLE = 'exemplo';

/**
 * Creates the example — the application and a ready test project with a passing spec and a ticket —
 * unless either part already exists. Returns what was created.
 */
export function createExample(root: string, templatesDir: string = exampleTemplatesDir()): readonly string[] {
  const appDir = join(root, APP_DIR, EXAMPLE);
  const projectsDir = join(root, PROJECTS_SUBDIR);
  if (existsSync(appDir) || existsSync(join(projectsDir, EXAMPLE))) {
    return [];
  }
  mkdirSync(appDir, { recursive: true });

  const files = ['index.html', 'README.md', 'server.ts', 'tsconfig.json'];
  const portExemple = '3000';

  for (const file of files) {
    let content = readFileSync(join(templatesDir, file), 'utf-8');

    if (file === 'server.ts') {
      content = content.replace('{{PORT_EXEMPLE}}', portExemple);
    }

    writeFileSync(join(appDir, file), content, 'utf-8');
  }

  createProject(projectsDir, EXAMPLE, projectTemplatesDir(), {
    appDir,
    baseUrl: `http://localhost:${portExemple}`,
  });
  const project = join(projectsDir, EXAMPLE);
  // Only Chromium, the browser the next steps install.
  const configFile = join(project, PROJECT_CONFIG_FILE);
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
  writeFileSync(
    configFile,
    `${JSON.stringify(
      {
        ...config,
        devices: { chromium: true, firefox: false, webkit: false, 'mobile-chrome': false },
      },
      null,
      2,
    )}\n`,
  );
  // The page has no login: the environment needs no credentials.
  writeFileSync(join(project, PROJECT_ENV_FILE), `${JSON.stringify({ development: {} }, null, 2)}\n`);
  copyFileSync(join(templatesDir, 'spec'), join(project, TESTS_SUBDIR, `${EXAMPLE}.spec.ts`));
  copyFileSync(join(templatesDir, 'ticket.json'), join(project, TICKETS_SUBDIR, '1.json'));
  // Nothing else starts the application: the project's hooks bring it up and down around each run.
  for (const hook of ['global-setup', 'global-teardown']) {
    const content = readFileSync(join(templatesDir, hook), 'utf8').replace('{{PORT_EXEMPLE}}', portExemple);
    writeFileSync(join(project, `${hook}.ts`), content);
  }
  return [
    `${APP_DIR}/${EXAMPLE}/`,
    `${PROJECTS_SUBDIR}/${EXAMPLE}/`,
    `config.json (Chromium only)`,
    `.env.json (sem credenciais)`,
    `tests/${EXAMPLE}.spec.ts`,
    `tickets/1.json`,
    'global-setup.ts e global-teardown.ts (sobem e derrubam o servidor do exemplo)',
  ];
}

/** The editor settings that point every agent.yaml under .choliba/agents at the schema shipped with choliba. */
function schemaMapping(templatesDir: string): Record<string, unknown> {
  // Our own template: always a settings object with "yaml.schemas".
  const settings = JSON.parse(readFileSync(join(templatesDir, 'vscode-settings'), 'utf8')) as {
    'yaml.schemas': Record<string, unknown>;
  };
  return settings['yaml.schemas'];
}

/**
 * Adds the agent.yaml schema to `.vscode/settings.json` (creating it when missing), keeping every
 * other setting. A settings file that is not plain JSON (with comments, say) is left alone.
 */
export function addEditorSettings(root: string, templatesDir: string = workspaceTemplatesDir()): boolean {
  const file = join(root, '.vscode', 'settings.json');
  let settings: unknown = {};
  if (existsSync(file)) {
    try {
      settings = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return false;
    }
  }
  if (!isRecord(settings)) return false;
  const current = isRecord(settings['yaml.schemas']) ? settings['yaml.schemas'] : {};
  const mapping = schemaMapping(templatesDir);
  if (Object.keys(mapping).every((schema) => schema in current)) return false;
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) {
    // A new file is the template as it is, already in the workspace's Prettier style.
    copyFileSync(join(templatesDir, 'vscode-settings'), file);
    return true;
  }
  writeFileSync(file, `${JSON.stringify({ ...settings, 'yaml.schemas': { ...current, ...mapping } }, null, 2)}\n`);
  return true;
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
      created.push(`${dir.split(sep).join('/')}/`);
    }
  }
  for (const [template, file] of WORKSPACE_FILES) {
    if (!existsSync(join(root, file))) {
      copyFileSync(join(templatesDir, template), join(root, file));
      created.push(file);
    }
  }
  if (!existsSync(join(root, ENV_FILE))) {
    writeFileSync(join(root, ENV_FILE), initialEnv(readFileSync(join(templatesDir, 'env'), 'utf8'), root));
    created.push(ENV_FILE);
  }
  return created;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The scripts a workspace gets, named as in the choliba repository (`bun chol:…`). */
export const WORKSPACE_SCRIPTS: Readonly<Record<string, string>> = {
  'chol:help': 'choliba --help',
  'chol:check': 'choliba check',
  'chol:agents': 'choliba agents',
  'chol:projects': 'choliba projects',
  'chol:project:create': 'choliba projects create-project',
  'chol:project:list': 'choliba projects list-projects',
  'chol:ticket:create': 'choliba projects create-ticket',
  'chol:tests': 'choliba tests',
  'chol:install': 'choliba install',
  'chol:lint': 'choliba lint',
  'chol:format': 'choliba format',
  'chol:format:fix': 'choliba format --write',
};

/** Scripts an earlier `setup` added for commands that no longer exist, with the command they ran. */
const RETIRED_SCRIPTS: Readonly<Record<string, string>> = {
  'chol:playwright-cli': 'choliba playwright-cli',
  'chol:playwright-trace': 'choliba playwright-trace',
};

/** The workspace package.json as an object; undefined when missing, unreadable or not an object. */
function readPackage(root: string): Record<string, unknown> | undefined {
  const file = join(root, PACKAGE_FILE);
  if (!existsSync(file)) return undefined;
  try {
    const pkg: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return isRecord(pkg) ? pkg : undefined;
  } catch {
    return undefined;
  }
}

function writePackage(root: string, pkg: Readonly<Record<string, unknown>>): void {
  writeFileSync(join(root, PACKAGE_FILE), `${JSON.stringify(pkg, null, 2)}\n`);
}

/**
 * Adds `WORKSPACE_SCRIPTS` to the workspace package.json — only the ones it lacks, never replacing a
 * script of the same name. Returns the names added.
 */
export function addScripts(root: string): readonly string[] {
  const pkg = readPackage(root);
  if (pkg === undefined) return [];
  const scripts = isRecord(pkg['scripts']) ? pkg['scripts'] : {};
  const added = Object.keys(WORKSPACE_SCRIPTS).filter((name) => !(name in scripts));
  if (added.length > 0) {
    writePackage(root, {
      ...pkg,
      scripts: { ...scripts, ...Object.fromEntries(added.map((name) => [name, WORKSPACE_SCRIPTS[name]])) },
    });
  }
  return added;
}

/**
 * Removes `RETIRED_SCRIPTS` from the workspace package.json — only the ones still running the retired
 * command, so a script the user changed stays. Returns the names removed.
 */
export function removeRetiredScripts(root: string): readonly string[] {
  const pkg = readPackage(root);
  if (pkg === undefined || !isRecord(pkg['scripts'])) return [];
  const scripts = pkg['scripts'];
  const removed = Object.keys(RETIRED_SCRIPTS).filter((name) => scripts[name] === RETIRED_SCRIPTS[name]);
  if (removed.length > 0) {
    writePackage(root, {
      ...pkg,
      scripts: Object.fromEntries(Object.entries(scripts).filter(([name]) => !removed.includes(name))),
    });
  }
  return removed;
}

/**
 * Lists choliba in the workspace package.json `trustedDependencies`, so Bun runs this setup on every
 * later install or upgrade instead of blocking it. Returns whether the file changed; a missing or
 * unreadable package.json is left alone.
 */
export function trustPackage(root: string): boolean {
  const pkg = readPackage(root);
  if (pkg === undefined) return false;
  const current = pkg['trustedDependencies'];
  const trusted = Array.isArray(current) ? current.filter((item): item is string => typeof item === 'string') : [];
  if (trusted.includes('choliba')) return false;
  writePackage(root, { ...pkg, trustedDependencies: [...trusted, 'choliba'] });
  return true;
}

/** Whether the workspace package.json already lists choliba — during `bun add`'s postinstall it does not yet. */
export function packageListsCholiba(root: string): boolean {
  const pkg = readPackage(root);
  return (
    pkg !== undefined &&
    ['dependencies', 'devDependencies'].some((key) => {
      const deps = pkg[key];
      return isRecord(deps) && 'choliba' in deps;
    })
  );
}

/** What `setup` changes in the workspace package.json: `trustedDependencies` and the `chol:*` scripts. */
export function updatePackage(root: string): readonly string[] {
  const trusted = trustPackage(root);
  const scripts = addScripts(root);
  const retired = removeRetiredScripts(root);
  return [
    ...(trusted ? ['trustedDependencies no package.json'] : []),
    ...(scripts.length === 0 ? [] : [`scripts ${scripts.join(', ')} no package.json`]),
    ...(retired.length === 0 ? [] : [`scripts ${retired.join(', ')} removidos do package.json (comandos que saíram)`]),
  ];
}

/**
 * `setup --deferred`: waits (up to `timeoutMs`) for the package manager to write a package.json that
 * lists choliba, then updates it. Returns whether it got to do so.
 */
export async function updatePackageWhenListed(
  root: string,
  wait: (ms: number) => Promise<void>,
  timeoutMs = 60_000,
  stepMs = 200,
): Promise<boolean> {
  for (let waited = 0; waited < timeoutMs; waited += stepMs) {
    if (packageListsCholiba(root)) {
      // The listing is written together with the rest of the file; give it a moment to settle.
      await wait(stepMs);
      updatePackage(root);
      return true;
    }
    await wait(stepMs);
  }
  return false;
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
export function setup(
  home: string,
  cwd: string,
  defer: () => void,
  templatesDir: string = workspaceTemplatesDir(),
  exampleDir: string = exampleTemplatesDir(),
): string {
  const root = setupWorkspace(cwd);
  // The example comes with a new workspace only: once app/projects exists, a removed example stays removed.
  const isNew = !existsSync(join(root, PROJECTS_SUBDIR));
  const scaffolded = scaffoldWorkspace(root, templatesDir);
  const example = isNew ? createExample(root, exampleDir) : [];
  const editor = addEditorSettings(root, templatesDir);
  // `bun add` writes package.json after the postinstall, over any change made now: then the update waits for it.
  const listed = packageListsCholiba(root);
  if (!listed) defer();
  const packageChanges = listed ? updatePackage(root) : ['scripts chol:* no package.json (assim que o bun terminar)'];
  const created = [
    ...scaffolded,
    ...example,
    ...(editor ? ['.vscode/settings.json (schema dos agent.yaml)'] : []),
    ...packageChanges,
  ];
  const structure =
    created.length === 0
      ? `Pasta de trabalho: ${root} (já estava pronta).`
      : `Pasta de trabalho: ${root}\n  criado: ${created.join(', ')}`;
  return ['choliba instalado.', '', structure, setupShell(home), '', NEXT_STEPS].join('\n');
}
