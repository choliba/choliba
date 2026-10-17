import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { coreShell } from '@choliba/core';
import { fakePlatform, runShell } from '@choliba/core/testing';

import { cholibaShell } from '../../app-shell';
import type { HttpResponse, Runtime } from '../../runtime';
import { fakeRuntime, withWorkspace, type FakeRuntime } from '../helpers/runtime';

const BODY = readFileSync(join(__dirname, 'fixtures', 'release-body.md'), 'utf8');
const API = 'https://api.github.com/repos/choliba/choliba/releases/tags/v0.0.1-dev';
const PACKAGE_URL = 'https://github.com/x/choliba-0.0.1-dev.tgz';
const HASH_URL = `${PACKAGE_URL}.sha256`;
const PACKAGE = Buffer.from('o pacote novo');
const SHA = createHash('sha256').update(PACKAGE).digest('hex');

function response(body: string | Buffer, status = 200): HttpResponse {
  const bytes = typeof body === 'string' ? Buffer.from(body) : body;
  return {
    ok: status < 400,
    status,
    text: () => Promise.resolve(bytes.toString()),
    arrayBuffer: () => Promise.resolve(new Uint8Array(bytes).buffer),
  };
}

const RELEASE = {
  name: '0.0.1-dev.62 (2026-10-15)',
  body: BODY,
  assets: [
    { name: 'choliba-0.0.1-dev.tgz', browser_download_url: PACKAGE_URL },
    { name: 'choliba-0.0.1-dev.tgz.sha256', browser_download_url: HASH_URL },
  ],
};

/** The network of a spec: each URL's response; a URL it does not know has no network. */
function network(answers: Readonly<Record<string, HttpResponse>>): { get: Runtime['get']; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    get: (url, headers) => {
      asked.push(url);
      if (url === API) expect(headers).toMatchObject({ 'User-Agent': 'choliba-update' });
      const answer = answers[url];
      return answer === undefined ? Promise.reject(new Error('getaddrinfo ENOTFOUND')) : Promise.resolve(answer);
    },
  };
}

const RELEASE_RESPONSE = response(JSON.stringify(RELEASE));

const ONLINE: Readonly<Record<string, HttpResponse>> = {
  [API]: RELEASE_RESPONSE,
  [PACKAGE_URL]: response(PACKAGE),
  [HASH_URL]: response(`${SHA}  choliba-0.0.1-dev.tgz\n`),
};

/** The choliba the workspace has installed: its package.json in `node_modules`. */
function installed(root: string, version: string, gitHead = 'aaaaaaa1111'): void {
  mkdirSync(join(root, 'node_modules', 'choliba'), { recursive: true });
  writeFileSync(
    join(root, 'node_modules', 'choliba', 'package.json'),
    JSON.stringify({ name: 'choliba', version, gitHead }),
  );
}

/** An installed runtime (its entry in `bin/`), on `answers`, whose `bun add` exits `status` and installs version 62. */
function installedRuntime(
  root: string,
  answers: Readonly<Record<string, HttpResponse>> = ONLINE,
  status: number | null = 0,
): FakeRuntime & { asked: string[] } {
  const net = network(answers);
  const runtime = fakeRuntime({
    entryDir: join(root, 'node_modules', 'choliba', 'bin'),
    get: net.get,
    capture: (command, args, cwd) => {
      runtime.runs.push({ command, args, cwd });
      if (status === 0) installed(root, '0.0.1-dev.62', '27dbedbffff');
      return { status, stderr: status === 0 ? '' : 'error: falhou ao resolver\n' };
    },
  });
  return Object.assign(runtime, { asked: net.asked });
}

async function update(
  root: string,
  runtime: FakeRuntime,
  args: readonly string[] = [],
  env: Readonly<Record<string, string>> = {},
): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['update', ...args], cwd: root, env });
  const code = await runShell([coreShell, cholibaShell(runtime)], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba update', () => {
  it('downloads the newer package, checks it, installs it with bun add and says what changed and what is new', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.60');
      writeFileSync(join(root, 'choliba-0.0.1-dev.tgz'), 'o pacote antigo');
      writeFileSync(join(root, 'choliba-0.0.1-dev.tgz.sha256'), 'hash antigo');
      const runtime = installedRuntime(root);

      const { code, out, err } = await update(root, runtime);

      expect(code).toBe(0);
      expect(err).toBe('Baixando 0.0.1-dev.62 (2026-10-15)…\nInstalando choliba-0.0.1-dev.62.tgz…\n');
      expect(runtime.runs).toEqual([
        { command: '/usr/bin/bun', args: ['add', '--trust', './choliba-0.0.1-dev.62.tgz'], cwd: root },
      ]);
      expect(readFileSync(join(root, 'choliba-0.0.1-dev.62.tgz'))).toEqual(PACKAGE);
      expect(readdirSync(root).filter((name) => name.endsWith('.tgz') || name.endsWith('.sha256'))).toEqual([
        'choliba-0.0.1-dev.62.tgz',
      ]);
      const lines = out.split('\n');
      expect(lines[0]).toBe('Atualizado de 0.0.1-dev.60+aaaaaaa para 0.0.1-dev.62+27dbedb.');
      expect(lines.slice(1, 4)).toEqual(['', 'Novidades:', '']);
      expect(out).toContain('0.0.1-dev.62+27dbedb');
      expect(out).toContain('0.0.1-dev.61+787a582');
      expect(out).not.toContain('0.0.1-dev.60+c4d4ca7');
      expect(lines.at(-2)).toBe('Detalhes: https://github.com/choliba/choliba/releases');
    }));

  it('says it is up to date when the release is not newer, downloading nothing', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.62', '27dbedbffff');
      const runtime = installedRuntime(root);

      const { code, out } = await update(root, runtime);

      expect([code, out]).toEqual([0, 'O choliba já está na versão mais recente (0.0.1-dev.62+27dbedb).\n']);
      expect([runtime.asked, runtime.runs]).toEqual([[API], []]);
    }));

  it('with --check, says what version would come and what is new, installing nothing', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.61');
      const runtime = installedRuntime(root);

      const { code, out } = await update(root, runtime, ['--check']);

      expect(code).toBe(0);
      expect(out.split('\n')[0]).toBe(
        'Há uma versão nova: 0.0.1-dev.62 (2026-10-15) (instalada: 0.0.1-dev.61+aaaaaaa).',
      );
      expect(out).toContain('0.0.1-dev.62+27dbedb');
      expect(out).not.toContain('0.0.1-dev.61+787a582');
      expect(out.trimEnd().split('\n').at(-1)).toBe('Para atualizar: choliba update');
      expect(out).not.toContain('\u001b[');
      expect([runtime.asked, runtime.runs]).toEqual([[API], []]);
    }));

  it('puts the versions in bold when the output takes color', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.61');

      const { out } = await update(root, installedRuntime(root), ['--check'], { FORCE_COLOR: '1' });

      expect(out).toContain('\u001b[1m0.0.1-dev.62+27dbedb\u001b[22m (#207)');
    }));

  it('installs the release over a package of no release (a local build), whose version has no number', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev');
      const runtime = installedRuntime(root);

      const { code, out } = await update(root, runtime);

      expect(code).toBe(0);
      expect(out.split('\n')[0]).toBe('Atualizado de 0.0.1-dev+aaaaaaa para 0.0.1-dev.62+27dbedb.');
    }));

  it('installs nothing when the package does not match the release SHA-256', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.60');
      const runtime = installedRuntime(root, { ...ONLINE, [HASH_URL]: response('f00d  choliba-0.0.1-dev.tgz') });

      const { code, err } = await update(root, runtime);

      expect(code).toBe(1);
      expect(err).toContain(
        `O pacote baixado não confere com o SHA-256 da release (${SHA} ≠ f00d): nada foi instalado.`,
      );
      expect([runtime.runs, existsSync(join(root, 'choliba-0.0.1-dev.62.tgz'))]).toEqual([[], false]);
    }));

  it('passes on the code of a bun add that fails, keeping the earlier package', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.60');
      writeFileSync(join(root, 'choliba-0.0.1-dev.tgz'), 'o pacote antigo');
      const runtime = installedRuntime(root, ONLINE, 7);

      const { code, out, err } = await update(root, runtime);

      expect([code, out]).toEqual([7, '']);
      expect(err).toContain(
        'error: falhou ao resolver\nO bun add terminou com código 7: o choliba continua em 0.0.1-dev.60+aaaaaaa.',
      );
      expect(existsSync(join(root, 'choliba-0.0.1-dev.tgz'))).toBe(true);
    }));

  it('ends with code 1 when bun add does not start', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.60');

      const { code, err } = await update(root, installedRuntime(root, ONLINE, null));

      expect([code, err]).toEqual([1, expect.stringContaining('O bun add terminou com código 1')]);
    }));

  it('says why when there is no network, the API refuses, or the release is not as expected', () =>
    withWorkspace(async (root) => {
      installed(root, '0.0.1-dev.60');
      const cases: [Readonly<Record<string, HttpResponse>>, string][] = [
        [{}, `Sem acesso a ${API}: getaddrinfo ENOTFOUND.`],
        [{ [API]: response('limite', 403) }, `O GitHub respondeu 403 para ${API}.`],
        [{ [API]: response(JSON.stringify({ ...RELEASE, name: 'nightly' })) }, 'título sem versão: "nightly"'],
        [{ [API]: response(JSON.stringify({ ...RELEASE, name: 7, assets: [] })) }, 'título sem versão: ""'],
        [{ [API]: response(JSON.stringify({ ...RELEASE, assets: [] })) }, 'não tem o arquivo choliba-0.0.1-dev.tgz.'],
        [{ [API]: response(JSON.stringify({ ...RELEASE, assets: 'x', body: 1 })) }, 'não tem o arquivo'],
        [{ [API]: RELEASE_RESPONSE }, `Sem acesso a ${PACKAGE_URL}: getaddrinfo ENOTFOUND.`],
      ];
      for (const [answers, message] of cases) {
        const { code, err } = await update(root, installedRuntime(root, answers));
        expect([code, err]).toEqual([1, expect.stringContaining(message)]);
      }
    }));

  it('refuses when it runs from the sources, which update with git pull', () =>
    withWorkspace(async (root) => {
      const runtime = fakeRuntime();

      const { code, err } = await update(root, runtime);

      expect([code, err]).toEqual([1, expect.stringContaining('roda do código-fonte')]);
      expect(runtime.runs).toEqual([]);
    }));

  it('rejects an unknown option, and prints its help', () =>
    withWorkspace(async (root) => {
      const wrong = await update(root, fakeRuntime(), ['--now']);
      expect([wrong.code, wrong.err]).toEqual([1, expect.stringContaining('opção desconhecida: --now')]);

      const help = await update(root, fakeRuntime(), ['--help']);
      expect(help.out).toContain('choliba update [--check]');
    }));
});
