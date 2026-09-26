import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FILES_MARKER } from '@choliba/core/cli';

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
  it('creates the folders, .env.example, .gitignore and a .env pointing GLOBAL_DIR at the workspace', () => {
    withDir((root) => {
      expect(scaffoldWorkspace(root)).toEqual([
        'agents/',
        '.agents/skills/',
        '.agents/mcps/',
        'projects/',
        '.env.example',
        '.gitignore',
        'bunfig.toml',
        '.env',
      ]);
      expect(fs.readFileSync(path.join(root, 'bunfig.toml'), 'utf8')).toContain('silent = true');
      expect(fs.existsSync(path.join(root, '.agents', 'mcps', '.gitkeep'))).toBe(true);
      expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toContain(`\nGLOBAL_DIR=${root}\n`);
      expect(fs.readFileSync(path.join(root, '.env.example'), 'utf8')).toContain('\nGLOBAL_DIR=\n');
      expect(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain('.env');
    });
  });

  it('never overwrites what is already there', () => {
    withDir((root) => {
      fs.mkdirSync(path.join(root, 'agents'));
      fs.writeFileSync(path.join(root, '.env'), 'MEU=1\n');
      fs.writeFileSync(path.join(root, '.gitignore'), 'x\n');

      expect(scaffoldWorkspace(root, workspaceTemplatesDir())).toEqual([
        '.agents/skills/',
        '.agents/mcps/',
        'projects/',
        '.env.example',
        'bunfig.toml',
      ]);
      expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe('MEU=1\n');
      expect(scaffoldWorkspace(root)).toEqual([]);
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
  it('fills GLOBAL_DIR and leaves the rest as the example has it', () => {
    expect(initialEnv('# a\nGLOBAL_DIR=\n# GLOBAL_DIR=x\nB=1\n', '/w')).toBe(
      '# a\nGLOBAL_DIR=/w\n# GLOBAL_DIR=x\nB=1\n',
    );
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

  it('prepares the workspace, the shell and says what to do next', () => {
    withDir((dir) => {
      const home = path.join(dir, 'home');
      const workspace = path.join(dir, 'goiaba');
      fs.mkdirSync(home);
      fs.mkdirSync(workspace);
      fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ dependencies: { choliba: '1' } }));

      const first = setup(home, workspace);
      expect(first).toContain(`Pasta de trabalho: ${workspace}\n  criado: agents/, .agents/skills/`);
      expect(first).toContain('trustedDependencies no package.json');
      expect(first).toContain('scripts chol:help, chol:check, chol:agents');
      expect(first).toContain('Próximos passos:');
      expect(setup(home, workspace)).toContain(`Pasta de trabalho: ${workspace} (já estava pronta).`);
    });
  });
});
