import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FILES_MARKER } from '../../help/complete';
import { COMPLETION_BASH } from '../../help/completion-bash';
import {
  completionFile,
  completionSourceLine,
  ensureShellCompletion,
  installShellCompletion,
  shellCompletionInstalled,
} from '../../help/shell-completion';

function withDir(run: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'choliba-shell-'));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('the completion script', () => {
  it('is valid bash and asks the choliba on PATH for choliba and chol', () => {
    expect(COMPLETION_BASH).toContain('command -v choliba');
    expect(COMPLETION_BASH).toContain('complete -F _choliba_complete chol');
    expect(COMPLETION_BASH).toContain(`== "${FILES_MARKER}"`);
    withDir((dir) => {
      const file = path.join(dir, 'completion.bash');
      fs.writeFileSync(file, COMPLETION_BASH);
      expect(spawnSync('bash', ['-n', file]).status).toBe(0);
    });
  });
});

describe('installShellCompletion', () => {
  it('writes the script and the bashrc line once', () => {
    withDir((home) => {
      expect(shellCompletionInstalled(home)).toBe(false);
      expect(installShellCompletion(home)).toContain('Autocomplete ligado');
      expect(fs.readFileSync(completionFile(home), 'utf8')).toBe(COMPLETION_BASH);
      expect(shellCompletionInstalled(home)).toBe(true);
      expect(installShellCompletion(home)).toContain('já estava ligado');
      const bashrc = fs.readFileSync(path.join(home, '.bashrc'), 'utf8');
      expect(bashrc.split(completionSourceLine(home)).length - 1).toBe(1);
    });
  });
});

describe('ensureShellCompletion', () => {
  it('installs and warns when the script or the line is missing, and stays quiet once both are there', () => {
    withDir((home) => {
      const stderr: string[] = [];
      const write = (chunk: string): void => {
        stderr.push(chunk);
      };
      ensureShellCompletion(home, ['new'], { write });
      expect(stderr.join('')).toContain('Autocomplete ligado');
      expect(shellCompletionInstalled(home)).toBe(true);

      stderr.length = 0;
      ensureShellCompletion(home, ['generate', 'project'], { write });
      expect(stderr).toEqual([]);
    });
  });

  it('does not touch the shell while completing', () => {
    withDir((home) => {
      const stderr: string[] = [];
      ensureShellCompletion(home, ['__complete', ''], {
        write: (chunk) => {
          stderr.push(chunk);
        },
      });
      ensureShellCompletion(home, ['__describe'], { write: () => undefined });
      ensureShellCompletion(home, ['__entries'], { write: () => undefined });
      expect(stderr).toEqual([]);
      expect(fs.existsSync(completionFile(home))).toBe(false);
      expect(fs.existsSync(path.join(home, '.bashrc'))).toBe(false);
    });
  });

  it('replaces a script left by an older setup, and still warns to open a new terminal', () => {
    withDir((home) => {
      const file = completionFile(home);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, '# script antigo\n');
      fs.writeFileSync(path.join(home, '.bashrc'), `${completionSourceLine(home)}\n`);
      const stderr: string[] = [];
      ensureShellCompletion(home, ['--help'], {
        write: (chunk) => {
          stderr.push(chunk);
        },
      });
      expect(fs.readFileSync(file, 'utf8')).toBe(COMPLETION_BASH);
      expect(stderr.join('')).toContain('abra um terminal novo');
      expect(shellCompletionInstalled(home)).toBe(true);
    });
  });

  it('rewrites a missing script when the line is already there, and still warns', () => {
    withDir((home) => {
      const file = completionFile(home);
      fs.writeFileSync(path.join(home, '.bashrc'), `# keep\n[ -f "${file}" ] && source "${file}"\n`);
      const stderr: string[] = [];
      ensureShellCompletion(home, [], {
        write: (chunk) => {
          stderr.push(chunk);
        },
      });
      expect(fs.readFileSync(file, 'utf8')).toBe(COMPLETION_BASH);
      expect(stderr.join('')).toContain('abra um terminal novo');
      expect(fs.readFileSync(path.join(home, '.bashrc'), 'utf8').split('\n')).toHaveLength(3);
    });
  });
});
