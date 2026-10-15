import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Platform } from '@choliba/core';
import { BufferWritable, fakePlatform } from '@choliba/core/testing';

import { createCholibaShell } from '../../app-shell';
import { fakeRuntime } from '../helpers/runtime';
import { makeWorkspace } from '../helpers/workspace';

async function setConfig(
  args: readonly string[],
  cwd: string,
  extra: Partial<Pick<Platform, 'env' | 'askSecret' | 'readStdin'>> = {},
): Promise<{ code: number; out: string; err: string }> {
  const stdout = new BufferWritable();
  const stderr = new BufferWritable();
  const code = await createCholibaShell(
    fakePlatform({ argv: ['set', 'config', ...args], cwd, stdout, stderr, ...extra }),
    fakeRuntime(),
  ).run();
  return { code, out: stdout.text(), err: stderr.text() };
}

function envOf(root: string): string {
  return readFileSync(join(root, '.env'), 'utf8');
}

describe('choliba set config', () => {
  it('writes the key into the .env and says what it was before', async () => {
    const workspace = makeWorkspace({ '.env': 'CHOL_NETWORK=isolated\n' });
    try {
      const sandbox = await setConfig(['CHOL_SANDBOX', 'docker'], workspace.path);
      const network = await setConfig(['CHOL_NETWORK', 'host'], workspace.path);

      expect(sandbox).toEqual({
        code: 0,
        out: 'CHOL_SANDBOX=docker gravado em .env (antes: local, padrão).\n',
        err: '',
      });
      expect(network.out).toBe('CHOL_NETWORK=host gravado em .env (antes: isolated, .env).\n');
      expect(envOf(workspace.path)).toBe('CHOL_NETWORK=host\nCHOL_SANDBOX=docker\n');
    } finally {
      workspace.cleanup();
    }
  });

  it('says a key no one defined was not defined', async () => {
    const workspace = makeWorkspace({ '.env': '' });
    try {
      const { out } = await setConfig(['CHOL_COLORS', 'agent=red'], workspace.path);

      expect(out).toBe('CHOL_COLORS=agent=red gravado em .env (antes: não definida).\n');
    } finally {
      workspace.cleanup();
    }
  });

  it('warns when the environment defines the key with another value, and not when it agrees', async () => {
    const workspace = makeWorkspace({ '.env': '' });
    try {
      const other = await setConfig(['CHOL_SANDBOX', 'docker'], workspace.path, { env: { CHOL_SANDBOX: 'local' } });
      const same = await setConfig(['CHOL_SANDBOX', 'docker'], workspace.path, { env: { CHOL_SANDBOX: 'docker' } });

      expect(other.code).toBe(0);
      expect(other.out).toBe('CHOL_SANDBOX=docker gravado em .env (antes: local, ambiente).\n');
      expect(other.err).toContain('O ambiente do processo define CHOL_SANDBOX=local e vence o .env.');
      expect(same.err).toBe('');
    } finally {
      workspace.cleanup();
    }
  });

  it('refuses an unknown key and a value outside the key’s list, writing nothing', async () => {
    const workspace = makeWorkspace({ '.env': 'CHOL_SANDBOX=local\n' });
    try {
      const unknown = await setConfig(['CHOL_NADA', 'x'], workspace.path);
      const invalid = await setConfig(['CHOL_SANDBOX', 'vm'], workspace.path);

      expect(unknown.code).toBe(1);
      expect(unknown.err).toContain('CHOL_NADA');
      expect(invalid.code).toBe(1);
      expect(invalid.err).toContain('vm');
      expect(envOf(workspace.path)).toBe('CHOL_SANDBOX=local\n');
    } finally {
      workspace.cleanup();
    }
  });

  it('gives a usage error without a key, without the value of a common key, or with too many arguments', async () => {
    const workspace = makeWorkspace({ '.env': '' });
    try {
      const none = await setConfig([], workspace.path);
      const noValue = await setConfig(['CHOL_SANDBOX'], workspace.path);
      const tooMany = await setConfig(['CHOL_SANDBOX', 'docker', 'local'], workspace.path);

      expect(none.code).toBe(1);
      expect(none.err).toContain('Use uma chave e o valor dela');
      expect(noValue.code).toBe(1);
      expect(noValue.err).toContain('Falta o valor de CHOL_SANDBOX.');
      expect(tooMany.code).toBe(1);
      expect(envOf(workspace.path)).toBe('');
    } finally {
      workspace.cleanup();
    }
  });

  it('fails outside a workspace, where there is no .env', async () => {
    const { code, err } = await setConfig(['CHOL_SANDBOX', 'docker'], '/');

    expect(code).toBe(1);
    expect(err).toContain('Fora de uma pasta de trabalho: não há .env para gravar.');
  });

  describe('a credential', () => {
    it('is asked without showing it at a terminal, and never printed', async () => {
      const workspace = makeWorkspace({ '.env': '' });
      const asked: string[] = [];
      try {
        const { code, out, err } = await setConfig(['CURSOR_API_KEY'], workspace.path, {
          askSecret: (question) => {
            asked.push(question);
            return Promise.resolve(' segredo \n');
          },
        });

        expect(code).toBe(0);
        expect(asked).toEqual(['CURSOR_API_KEY: ']);
        expect(out).toBe('CURSOR_API_KEY gravada em .env (antes: não definida).\n');
        expect(out + err).not.toContain('segredo');
        expect(envOf(workspace.path)).toBe('CURSOR_API_KEY=segredo\n');
      } finally {
        workspace.cleanup();
      }
    });

    it('is read from stdin outside a terminal, and the warning hides the environment’s value', async () => {
      const workspace = makeWorkspace({ '.env': 'CURSOR_API_KEY=velho\n' });
      try {
        const { code, out, err } = await setConfig(['CURSOR_API_KEY'], workspace.path, {
          env: { CURSOR_API_KEY: 'outro' },
          readStdin: () => Promise.resolve('novo\n'),
        });

        expect(code).toBe(0);
        expect(out).toBe('CURSOR_API_KEY gravada em .env (antes: definida, ambiente).\n');
        expect(err).toContain('O ambiente do processo define CURSOR_API_KEY e vence o .env.');
        expect(out + err).not.toMatch(/velho|outro|novo/);
        expect(envOf(workspace.path)).toBe('CURSOR_API_KEY=novo\n');
      } finally {
        workspace.cleanup();
      }
    });

    it('is refused on the command line, and an empty one is refused too', async () => {
      const workspace = makeWorkspace({ '.env': '' });
      try {
        const given = await setConfig(['CURSOR_API_KEY', 'segredo'], workspace.path);
        const empty = await setConfig(['CURSOR_API_KEY'], workspace.path, { readStdin: () => Promise.resolve('\n') });
        const nowhere = await setConfig(['CURSOR_API_KEY'], workspace.path);

        expect(given.code).toBe(1);
        expect(given.err).toContain('não vai na linha de comando');
        expect(empty.code).toBe(1);
        expect(empty.err).toContain('Nenhum valor recebido para CURSOR_API_KEY.');
        expect(nowhere.code).toBe(1);
        expect(envOf(workspace.path)).toBe('');
      } finally {
        workspace.cleanup();
      }
    });
  });

  it('prints its help', async () => {
    const { out } = await setConfig(['--help'], '/');

    expect(out).toContain('choliba set config CHAVE [VALOR]');
    expect(out).toContain('choliba set config CURSOR_API_KEY');
  });

  it('is listed by the help of set', async () => {
    const stdout = new BufferWritable();
    await createCholibaShell(fakePlatform({ argv: ['set', '--help'], cwd: '/', stdout }), fakeRuntime()).run();

    expect(stdout.text()).toMatch(/config +Grava uma chave da configuração no \.env/);
  });
});
