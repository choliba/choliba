import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  applyDeleteBridge,
  bridgeExists,
  deleteBridgePath,
  planDeleteBridge,
  shouldApplyDeleteBridge,
} from '../../runs/delete-bridge';
import { makeTmpDir } from '../helpers/tmp';

interface Bridged {
  readonly root: string;
  readonly app: string;
  /** Runs the written helper with `paths`, from the run dir, as the agent would. */
  readonly run: (...paths: string[]) => {
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
  };
}

/** A run dir and an `app/` root next to it, with the helper written for `allow` and `deny`. */
function withBridge(
  fn: (bridged: Bridged) => void,
  roots: (app: string) => { allow: string[]; deny?: string[] } = (app) => ({ allow: [`${app}/`] }),
): void {
  const tmp = makeTmpDir('delete-bridge');
  try {
    const app = join(tmp.path, 'app');
    const runDir = join(tmp.path, 'run');
    mkdirSync(app);
    mkdirSync(runDir);
    const { allow, deny = [] } = roots(app);
    const restore = applyDeleteBridge(runDir, allow, deny);
    try {
      fn({
        root: tmp.path,
        app,
        run: (...paths) => spawnSync('bun', [deleteBridgePath(runDir), ...paths], { cwd: runDir, encoding: 'utf8' }),
      });
    } finally {
      restore();
    }
  } finally {
    tmp.cleanup();
  }
}

describe('delete bridge', () => {
  it('is written next to the run dir, not inside it, and removed by the restore', () => {
    const tmp = makeTmpDir('delete-bridge-apply');
    try {
      const runDir = join(tmp.path, 'run');
      const plan = planDeleteBridge(runDir, ['/app/'], ['/app/secrets/']);
      expect(plan.path).toBe(`${runDir}.choliba-delete`);
      expect(plan.content).toContain('["/app/"]');
      expect(plan.content).toContain('["/app/secrets/"]');

      const restore = applyDeleteBridge(runDir, ['/app/']);
      expect(bridgeExists(runDir)).toBe(true);
      restore();
      restore();
      expect(existsSync(plan.path)).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('is a no-op when there are no allow roots', () => {
    const tmp = makeTmpDir('delete-bridge-empty');
    try {
      applyDeleteBridge(tmp.path, [])();
      expect(bridgeExists(tmp.path)).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('shouldApplyDeleteBridge follows allow.delete and the policy', () => {
    expect(shouldApplyDeleteBridge(['/app/'], 'edits')).toBe(true);
    expect(shouldApplyDeleteBridge(['/app/'], 'read-only')).toBe(false);
    expect(shouldApplyDeleteBridge([], 'edits')).toBe(false);
  });
});

describe('the written helper', () => {
  it('removes files and folders under an allow root, each printed', () => {
    withBridge(({ app, run }) => {
      writeFileSync(join(app, 'a.txt'), 'x');
      mkdirSync(join(app, 'dir', 'sub'), { recursive: true });

      const result = run(join(app, 'a.txt'), '../app/dir');

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(join(app, 'a.txt'));
      expect(existsSync(join(app, 'a.txt'))).toBe(false);
      expect(existsSync(join(app, 'dir'))).toBe(false);
    });
  });

  it('removes a symlink itself, never what it points to', () => {
    withBridge(({ root, app, run }) => {
      writeFileSync(join(app, 'real.txt'), 'kept');
      symlinkSync('real.txt', join(app, 'link'));
      writeFileSync(join(root, 'outside.txt'), 'kept');
      symlinkSync(join(root, 'outside.txt'), join(app, 'escape'));
      symlinkSync(app, join(app, 'loop'));

      expect(run(join(app, 'link'), join(app, 'escape'), join(app, 'loop')).status).toBe(0);
      expect(existsSync(join(app, 'real.txt'))).toBe(true);
      expect(existsSync(join(root, 'outside.txt'))).toBe(true);
      expect(existsSync(join(app, 'link'))).toBe(false);
      expect(existsSync(join(app, 'loop'))).toBe(false);
    });
  });

  it('removes a dangling symlink', () => {
    withBridge(({ app, run }) => {
      symlinkSync(join(app, 'gone'), join(app, 'dangling'));

      expect(run(join(app, 'dangling')).status).toBe(0);
    });
  });

  it('refuses what is outside the roots, reached through a symlinked folder, missing or a root itself', () => {
    withBridge(({ root, app, run }) => {
      mkdirSync(join(root, 'other'));
      writeFileSync(join(root, 'other', 'a.txt'), 'x');
      symlinkSync(join(root, 'other'), join(app, 'other-link'));

      expect(run(join(root, 'other', 'a.txt')).stderr).toMatch(/Fora dos diretórios permitidos/);
      expect(run(join(app, 'other-link', 'a.txt')).stderr).toMatch(/Fora dos diretórios permitidos/);
      expect(run(join(app, 'missing')).stderr).toMatch(/Não encontrado/);
      expect(run(app).stderr).toMatch(/raiz permitida/);
      expect(run(`${app}/`).status).toBe(1);
      expect(existsSync(join(root, 'other', 'a.txt'))).toBe(true);
      expect(existsSync(app)).toBe(true);
    });
  });

  it('refuses a path under a deny root', () => {
    withBridge(
      ({ app, run }) => {
        mkdirSync(join(app, 'secrets'));
        writeFileSync(join(app, 'secrets', 'key'), 'x');

        expect(run(join(app, 'secrets', 'key')).stderr).toMatch(/Apagar negado/);
        expect(existsSync(join(app, 'secrets', 'key'))).toBe(true);
      },
      (app) => ({ allow: [`${app}/`], deny: [`${app}/secrets/`] }),
    );
  });

  it('stops at the first refused path and says how to use it without one', () => {
    withBridge(({ app, run }) => {
      writeFileSync(join(app, 'b.txt'), 'x');

      expect(run(join(app, 'missing'), join(app, 'b.txt')).status).toBe(1);
      expect(existsSync(join(app, 'b.txt'))).toBe(true);
      expect(run().stderr).toMatch(/uso:/);
    });
  });

  it('refuses everything for a root that does not exist', () => {
    withBridge(
      ({ app, run }) => {
        writeFileSync(join(app, 'a.txt'), 'x');

        expect(run(join(app, 'a.txt')).stderr).toMatch(/Fora dos diretórios permitidos/);
      },
      (app) => ({ allow: [join(app, 'ghost')] }),
    );
  });
});
