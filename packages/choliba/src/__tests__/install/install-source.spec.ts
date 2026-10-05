import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSpawnGitRunner, type GitRunner } from '@choliba/core/platform';

import { fetchSource, sourceKind, type SourceDeps } from '../../install/install-source';

function withDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'install-source-'));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function deps(cwd: string, overrides: Partial<SourceDeps> = {}): SourceDeps {
  return {
    cwd,
    git: createSpawnGitRunner(),
    bunAdd: () => ({ status: 0, stderr: '' }),
    ...overrides,
  };
}

describe('sourceKind', () => {
  it('reads a folder or .json on disk as local, a repository address as git and anything else as npm', () => {
    withDir((dir) => {
      mkdirSync(join(dir, 'agente'));
      writeFileSync(join(dir, 'jira.json'), '{}');
      writeFileSync(join(dir, 'pacote.tgz'), '');
      const exists = (path: string): boolean => existsSync(join(dir, path));

      expect(sourceKind('agente', exists)).toBe('local');
      expect(sourceKind('jira.json', exists)).toBe('local');
      expect(sourceKind('pacote.tgz', exists)).toBe('npm');
      for (const spec of ['https://github.com/x/y', 'git@github.com:x/y.git', 'github:x/y', 'file:///r', 'x/y.git']) {
        expect(sourceKind(spec, exists)).toBe('git');
      }
      for (const spec of ['qa-agents', '@org/qa-agents@1.2.0']) {
        expect(sourceKind(spec, exists)).toBe('npm');
      }
    });
  });
});

describe('fetchSource', () => {
  it('uses a local folder as it is, relative to where the command runs, and leaves it there', () => {
    withDir((dir) => {
      mkdirSync(join(dir, 'agente'));
      const fetched = fetchSource('agente', deps(dir));

      expect(fetched.root).toBe(join(dir, 'agente'));
      fetched.cleanup();
      expect(existsSync(join(dir, 'agente'))).toBe(true);
    });
  });

  it('clones a git repository, at the ref after #, into a folder that cleanup removes', () => {
    withDir((dir) => {
      const repo = join(dir, 'repo');
      mkdirSync(repo);
      writeFileSync(join(repo, 'a.txt'), 'main');
      const git = (command: string): void => {
        execSync(`git -c user.email=t@t -c user.name=t ${command}`, { cwd: repo, stdio: 'ignore' });
      };
      git('init -q -b main');
      git('add a.txt');
      git('commit -q -m main');
      git('checkout -q -b outra');
      writeFileSync(join(repo, 'a.txt'), 'outra');
      git('commit -q -am outra');
      git('checkout -q main');

      const main = fetchSource(`file://${repo}`, deps(dir));
      expect(readFileSync(join(main.root, 'a.txt'), 'utf8')).toBe('main');
      main.cleanup();
      expect(existsSync(main.root)).toBe(false);

      const other = fetchSource(`file://${repo}#outra`, deps(dir));
      expect(readFileSync(join(other.root, 'a.txt'), 'utf8')).toBe('outra');
      other.cleanup();
    });
  });

  it('turns github:owner/repo into its https address, and fails with what git said', () => {
    withDir((dir) => {
      const calls: (readonly string[])[] = [];
      const git: GitRunner = {
        run: (args) => {
          calls.push(args);
          return { status: 128, stdout: '', stderr: 'repository not found' };
        },
      };

      expect(() => fetchSource('github:x/y', deps(dir, { git }))).toThrow('repository not found');
      expect(calls[0]).toEqual(expect.arrayContaining(['clone', '--depth', '1', 'https://github.com/x/y.git']));
    });
  });

  it('adds an npm package to a scratch project and uses the folder it lands in', () => {
    withDir((dir) => {
      const bunAdd: SourceDeps['bunAdd'] = (project, spec) => {
        expect(spec).toBe('@org/qa@1.0.0');
        mkdirSync(join(project, 'node_modules', '@org', 'qa'), { recursive: true });
        writeFileSync(join(project, 'package.json'), JSON.stringify({ dependencies: { '@org/qa': '1.0.0' } }));
        return { status: 0, stderr: '' };
      };

      const fetched = fetchSource('@org/qa@1.0.0', deps(dir, { bunAdd }));
      expect(fetched.root.endsWith(join('node_modules', '@org', 'qa'))).toBe(true);
      fetched.cleanup();
      expect(existsSync(fetched.root)).toBe(false);
    });
  });

  it('falls back on the spec as the folder name when the scratch project lists no dependency', () => {
    withDir((dir) => {
      const bunAdd: SourceDeps['bunAdd'] = (project) => {
        writeFileSync(join(project, 'package.json'), '{}');
        return { status: 0, stderr: '' };
      };

      const fetched = fetchSource('qa', deps(dir, { bunAdd }));
      expect(fetched.root.endsWith(join('node_modules', 'qa'))).toBe(true);
      fetched.cleanup();
    });
  });

  it('fails with what bun said when the package cannot be added', () => {
    withDir((dir) => {
      const bunAdd: SourceDeps['bunAdd'] = () => ({ status: 1, stderr: '404 Not Found' });

      expect(() => fetchSource('nao-existe', deps(dir, { bunAdd }))).toThrow('404 Not Found');
    });
  });
});
