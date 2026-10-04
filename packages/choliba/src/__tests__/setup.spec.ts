import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadProjectSettings } from '@choliba/projects';

import { FILES_MARKER } from '@choliba/core/cli';
import { DEFAULT_THEME, parseColors } from '@choliba/core/theme';

import { COMPLETION_BASH } from '../completion';
import {
  completionFile,
  initialEnv,
  scaffoldWorkspace,
  setup,
  setupShell,
  setupWorkspace,
  sourceLine,
  trustPackage,
  addEditorSettings,
  createExample,
  exampleTemplatesDir,
  packageListsCholiba,
  updatePackage,
  updatePackageWhenListed,
  addScripts,
  WORKSPACE_SCRIPTS,
  workspaceTemplatesDir,
} from '../setup';

function withDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'choliba-setup-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('COMPLETION_BASH', () => {
  it('completes choliba and bunx choliba by asking the workspace choliba, falling back to files', () => {
    expect(COMPLETION_BASH).toContain('complete -F _choliba_complete choliba');
    expect(COMPLETION_BASH).toContain('complete -F _choliba_complete_bunx bunx');
    expect(COMPLETION_BASH).toContain('complete -F _choliba_complete_bun bun');
    expect(COMPLETION_BASH).toContain('node_modules/.bin/choliba');
    expect(COMPLETION_BASH).toContain(`== "${FILES_MARKER}"`);
    expect(COMPLETION_BASH).toContain('_choliba_previous_bun');
  });
});

describe('COMPLETION_BASH as bash reads it', () => {
  it('is valid bash, with its backslashes intact', () => {
    withDir((dir) => {
      const file = path.join(dir, 'completion.bash');
      fs.writeFileSync(file, COMPLETION_BASH);
      expect(spawnSync('bash', ['-n', file]).status).toBe(0);
    });
    expect(COMPLETION_BASH).toContain(`printf '%s\\n' "$dir/node_modules/.bin/choliba"`);
    expect(COMPLETION_BASH).toContain('_choliba_previous_bun="${_choliba_previous_bun#*-F }"');
    expect(COMPLETION_BASH).toContain('local root="${1%/node_modules/.bin/choliba}"');
    expect(COMPLETION_BASH).toContain('_choliba_suggest "$at" "${script_words[@]:1}"');
  });
});

describe('scaffoldWorkspace', () => {
  it('lists the default colors in the .env, commented, so CHOL_COLORS starts choosing nothing', () => {
    withDir((root) => {
      scaffoldWorkspace(root);
      const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
      const defaults = [...env.matchAll(/^#\s+([a-z-]+\.[a-z-]+=[a-z-]+)$/gm)].map((match) => match[1]);

      expect(env).not.toMatch(/^CHOL_COLORS=./m);
      expect(parseColors(defaults.join(','))).toEqual(DEFAULT_THEME);
    });
  });

  it('creates .choliba/ (agents, skills, mcps), projects/ and the root files, with a working .env', () => {
    withDir((root) => {
      expect(scaffoldWorkspace(root)).toEqual([
        '.choliba/agents/',
        '.choliba/skills/',
        '.choliba/mcps/',
        'projects/',
        '.env.example',
        '.gitignore',
        'bunfig.toml',
        '.editorconfig',
        '.prettierrc.json',
        '.prettierignore',
        'eslint.config.mjs',
        '.env',
      ]);
      expect(fs.existsSync(path.join(root, '.choliba', 'mcps', '.gitkeep'))).toBe(true);
      const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
      expect(env).toContain(`\nCHOL_PROJECTS_DIR=${path.join(root, 'projects')}\n`);
      // The agents' folders are the defaults: the .env names them only as a commented example.
      expect(env).toContain('\n# CHOL_SKILLS_DIR=.choliba/skills\n');
      expect(env).not.toMatch(/^CHOL_(AGENTS|SKILLS|MCPS)_DIR=/m);
      expect(env).toContain(`\nCHOL_GLOBAL_DIR=${path.join(root, '.cache', 'choliba')}\n`);
      expect(fs.readFileSync(path.join(root, '.env.example'), 'utf8')).toContain('\nCHOL_GLOBAL_DIR=\n');
      expect(fs.readFileSync(path.join(root, 'bunfig.toml'), 'utf8')).toContain('silent = true');
      expect(fs.readFileSync(path.join(root, 'eslint.config.mjs'), 'utf8')).toContain("from 'choliba/eslint'");
    });
  });

  it('never overwrites what is already there', () => {
    withDir((root) => {
      fs.mkdirSync(path.join(root, '.choliba', 'agents'), { recursive: true });
      fs.writeFileSync(path.join(root, '.env'), 'MEU=1\n');
      fs.writeFileSync(path.join(root, '.gitignore'), 'x\n');

      const created = scaffoldWorkspace(root, workspaceTemplatesDir());
      expect(created).not.toContain('.choliba/agents/');
      expect(created).not.toContain('.env');
      expect(created).not.toContain('.gitignore');
      expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe('MEU=1\n');
      expect(scaffoldWorkspace(root)).toEqual([]);
    });
  });
});

describe('createExample', () => {
  it('creates the one-page application and a ready test project with its spec and ticket', () => {
    withDir((root) => {
      expect(createExample(root)).toEqual([
        'app/exemplo/',
        'projects/exemplo/',
        'config.json (Chromium only)',
        '.env.json (sem credenciais)',
        'tests/exemplo.spec.ts',
        'tickets/1.json',
        'global-setup.ts e global-teardown.ts (sobem e derrubam o servidor do exemplo)',
      ]);
      const app = path.join(root, 'app', 'exemplo');
      expect(fs.readdirSync(app).sort()).toEqual(['README.md', 'index.html', 'server.ts', 'tsconfig.json']);
      expect(fs.readFileSync(path.join(app, 'server.ts'), 'utf8')).toContain("port: '3000'");
      const project = path.join(root, 'projects', 'exemplo');
      const config = JSON.parse(fs.readFileSync(path.join(project, 'config.json'), 'utf8')) as {
        description: string;
        devices: Record<string, boolean>;
        envs: { baseURL: string; appDir: string }[];
        greenDeveloperHabilitado?: boolean;
      };
      expect(config.description).toBe(
        'Loja de exemplo: Uma página só, para experimentar o choliba: um formulário de newsletter que agradece quem assina.',
      );
      expect(config.envs[0]?.appDir).toBe(path.join(root, 'app', 'exemplo'));
      expect(config.envs[0]?.baseURL).toBe('http://localhost:3000');
      expect(config.devices).toEqual({ chromium: true, firefox: false, webkit: false, 'mobile-chrome': false });
      expect(config.greenDeveloperHabilitado).toBeUndefined();
      expect(fs.readFileSync(path.join(project, '.env.json'), 'utf8')).toContain('"development": {}');
      expect(fs.readFileSync(path.join(project, 'tests', 'exemplo.spec.ts'), 'utf8')).toContain("page.goto('')");
      expect(fs.existsSync(path.join(project, 'tickets', '1.json'))).toBe(true);
      const setupHook = fs.readFileSync(path.join(project, 'global-setup.ts'), 'utf8');
      expect(setupHook).toContain("'http://localhost:3000'");
      expect(setupHook).not.toContain('{{');
      expect(fs.readFileSync(path.join(project, 'global-teardown.ts'), 'utf8')).toContain('EXEMPLO_SERVER_PID');
      expect(loadProjectSettings(path.join(root, 'projects'), 'exemplo').environment.nome).toBe('development');
    });
  });

  it('creates nothing when either part already exists', () => {
    withDir((root) => {
      fs.mkdirSync(path.join(root, 'app', 'exemplo'), { recursive: true });
      expect(createExample(root, exampleTemplatesDir())).toEqual([]);
      fs.rmSync(path.join(root, 'app', 'exemplo'), { recursive: true });
      fs.mkdirSync(path.join(root, 'projects', 'exemplo'), { recursive: true });
      expect(createExample(root)).toEqual([]);
    });
  });
});

describe('addEditorSettings', () => {
  it('creates .vscode/settings.json with the agent.yaml schema, or adds it to the settings there', () => {
    withDir((root) => {
      expect(addEditorSettings(root)).toBe(true);
      const file = path.join(root, '.vscode', 'settings.json');
      expect(fs.readFileSync(file, 'utf8')).toContain('"./node_modules/choliba/schemes/v1/agent.schema.json"');
      expect(addEditorSettings(root)).toBe(false);

      fs.writeFileSync(file, JSON.stringify({ 'editor.tabSize': 4, 'yaml.schemas': { './outro.json': 'x.yaml' } }));
      expect(addEditorSettings(root)).toBe(true);
      const merged = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>>;
      expect(merged['editor.tabSize']).toBe(4);
      expect(Object.keys(merged['yaml.schemas'] ?? {})).toEqual([
        './outro.json',
        './node_modules/choliba/schemes/v1/agent.schema.json',
      ]);
    });
  });

  it('leaves settings it cannot read as JSON alone', () => {
    withDir((root) => {
      fs.mkdirSync(path.join(root, '.vscode'));
      fs.writeFileSync(path.join(root, '.vscode', 'settings.json'), '{ // comentário\n}');
      expect(addEditorSettings(root)).toBe(false);
      fs.writeFileSync(path.join(root, '.vscode', 'settings.json'), '[]');
      expect(addEditorSettings(root)).toBe(false);
    });
  });
});

describe('addScripts', () => {
  it('adds the chol:* scripts the workspace lacks, keeping any of the same name', () => {
    withDir((root) => {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(file, JSON.stringify({ name: 'g', scripts: { 'chol:tests': 'meu', build: 'x' } }));

      const added = addScripts(root);
      expect(added).toEqual(Object.keys(WORKSPACE_SCRIPTS).filter((name) => name !== 'chol:tests'));
      const scripts = (JSON.parse(fs.readFileSync(file, 'utf8')) as { scripts: Record<string, string> }).scripts;
      expect(scripts['chol:tests']).toBe('meu');
      expect(scripts['build']).toBe('x');
      expect(scripts['chol:project:create']).toBe('choliba projects create-project');
      expect(addScripts(root)).toEqual([]);
    });
  });

  it('starts a scripts section when there is none, and skips a package.json it cannot read', () => {
    withDir((root) => {
      expect(addScripts(root)).toEqual([]);
      fs.writeFileSync(path.join(root, 'package.json'), '{}');
      expect(addScripts(root)).toHaveLength(Object.keys(WORKSPACE_SCRIPTS).length);
    });
  });
});

describe('trustPackage', () => {
  it('adds choliba to trustedDependencies once, keeping the rest of package.json', () => {
    withDir((root) => {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(file, JSON.stringify({ name: 'g', trustedDependencies: ['outro', 1] }));

      expect(trustPackage(root)).toBe(true);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({
        name: 'g',
        trustedDependencies: ['outro', 'choliba'],
      });
      expect(trustPackage(root)).toBe(false);
    });
  });

  it('leaves a missing, unreadable or non-object package.json alone', () => {
    withDir((root) => {
      expect(trustPackage(root)).toBe(false);
      fs.writeFileSync(path.join(root, 'package.json'), '{ nope');
      expect(trustPackage(root)).toBe(false);
      fs.writeFileSync(path.join(root, 'package.json'), '[]');
      expect(trustPackage(root)).toBe(false);
      fs.writeFileSync(path.join(root, 'package.json'), '{}');
      expect(trustPackage(root)).toBe(true);
      expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).toContain('"choliba"');
    });
  });
});

describe('initialEnv', () => {
  it('points CHOL_PROJECTS_DIR at projects and CHOL_GLOBAL_DIR at .cache/choliba, leaving the rest as it is', () => {
    expect(initialEnv('# a\nCHOL_GLOBAL_DIR=\nCHOL_PROJECTS_DIR=\n# CHOL_GLOBAL_DIR=x\nB=1\n', '/w')).toBe(
      `# a\nCHOL_GLOBAL_DIR=${path.join('/w', '.cache', 'choliba')}\nCHOL_PROJECTS_DIR=${path.join('/w', 'projects')}\n# CHOL_GLOBAL_DIR=x\nB=1\n`,
    );
  });
});

describe('packageListsCholiba / updatePackage / updatePackageWhenListed', () => {
  it('updates package.json once it lists choliba, waiting for it when it does not yet', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'choliba-deferred-'));
    try {
      const file = path.join(root, 'package.json');
      fs.writeFileSync(file, JSON.stringify({ name: 'g' }));
      expect(packageListsCholiba(root)).toBe(false);

      let waits = 0;
      const wait = (): Promise<void> => {
        waits += 1;
        if (waits === 2) fs.writeFileSync(file, JSON.stringify({ name: 'g', devDependencies: { choliba: '1' } }));
        return Promise.resolve();
      };
      expect(await updatePackageWhenListed(root, wait, 10_000, 1)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        scripts: Record<string, string>;
        trustedDependencies: string[];
      };
      expect(pkg.trustedDependencies).toEqual(['choliba']);
      expect(pkg.scripts['chol:check']).toBe('choliba check');
      expect(updatePackage(root)).toEqual([]);
      expect(await updatePackageWhenListed(root, () => Promise.resolve())).toBe(true);

      fs.writeFileSync(file, JSON.stringify({ name: 'g' }));
      expect(await updatePackageWhenListed(root, () => Promise.resolve(), 3, 1)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('setupWorkspace', () => {
  it('is the workspace of the folder, or — inside node_modules — the folder of that node_modules', () => {
    withDir((dir) => {
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { choliba: '1' } }));
      expect(setupWorkspace(dir)).toBe(dir);
    });
    withDir((dir) => {
      const installed = path.join(dir, 'goiaba', 'node_modules', 'choliba');
      fs.mkdirSync(installed, { recursive: true });
      expect(setupWorkspace(installed)).toBe(path.join(dir, 'goiaba'));
      expect(() => setupWorkspace(dir)).toThrow('bun add choliba');
    });
  });
});

describe('setupShell / setup', () => {
  it('writes the completion script and adds its source line to ~/.bashrc once', () => {
    withDir((home) => {
      expect(setupShell(home)).toContain('Autocomplete ligado');
      expect(fs.readFileSync(completionFile(home), 'utf8')).toBe(COMPLETION_BASH);
      expect(setupShell(home)).toContain('Autocomplete já estava ligado');
      const bashrc = fs.readFileSync(path.join(home, '.bashrc'), 'utf8');
      expect(bashrc.split(sourceLine(home)).length - 1).toBe(1);
      expect(sourceLine(home)).toBe(`if [ -f "${completionFile(home)}" ]; then source "${completionFile(home)}"; fi`);
    });
  });

  it('does not add the line again when an older setup already loads the script another way', () => {
    withDir((home) => {
      fs.writeFileSync(
        path.join(home, '.bashrc'),
        `[ -f "${completionFile(home)}" ] && source "${completionFile(home)}"\n`,
      );

      expect(setupShell(home)).toContain('Autocomplete já estava ligado');
      expect(fs.readFileSync(path.join(home, '.bashrc'), 'utf8').split('\n')).toHaveLength(2);
    });
  });

  it('prepares a new workspace with the example, the shell and says what to do next', () => {
    withDir((dir) => {
      const home = path.join(dir, 'home');
      const workspace = path.join(dir, 'goiaba');
      fs.mkdirSync(home);
      fs.mkdirSync(workspace);
      fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ dependencies: { choliba: '1' } }));

      const first = setup(home, workspace, () => undefined);
      expect(first).toContain(`Pasta de trabalho: ${workspace}\n  criado: .choliba/agents/, .choliba/skills/`);
      expect(first).toContain('app/exemplo/, projects/exemplo/');
      expect(first).toContain('.vscode/settings.json (schema dos agent.yaml)');
      expect(first).toContain('trustedDependencies no package.json');
      expect(first).toContain('scripts chol:help, chol:check, chol:agents');
      expect(first).toContain('Próximos passos:');

      fs.rmSync(path.join(workspace, 'app', 'exemplo'), { recursive: true });
      fs.rmSync(path.join(workspace, 'projects', 'exemplo'), { recursive: true });
      expect(setup(home, workspace, () => undefined)).toContain(`Pasta de trabalho: ${workspace} (já estava pronta).`);
      expect(fs.existsSync(path.join(workspace, 'app', 'exemplo'))).toBe(false);
    });
  });

  it('leaves the package.json changes for later while it does not list choliba yet', () => {
    withDir((dir) => {
      const home = path.join(dir, 'home');
      const installed = path.join(dir, 'goiaba', 'node_modules', 'choliba');
      fs.mkdirSync(home);
      fs.mkdirSync(installed, { recursive: true });
      fs.writeFileSync(path.join(dir, 'goiaba', 'package.json'), JSON.stringify({ name: 'goiaba' }));
      let deferred = 0;

      const message = setup(
        home,
        installed,
        () => {
          deferred += 1;
        },
        workspaceTemplatesDir(),
        exampleTemplatesDir(),
      );
      expect(deferred).toBe(1);
      expect(message).toContain('scripts chol:* no package.json (assim que o bun terminar)');
      expect(fs.readFileSync(path.join(dir, 'goiaba', 'package.json'), 'utf8')).not.toContain('chol:');
    });
  });
});
