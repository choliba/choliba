import { createHash } from 'node:crypto';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { findManifest, messageOf, versionLine, type PackageManifest } from '@choliba/core';

import { PACKAGE_NAME } from '../help';
import type { HttpResponse, Runtime } from '../runtime';
import { releaseNumber, whatIsNew, type Emphasis } from './release-notes';

/** The development pre-release, which always points to the current build. */
const RELEASE_API = 'https://api.github.com/repos/choliba/choliba/releases/tags/v0.0.1-dev';
export const RELEASES_PAGE = 'https://github.com/choliba/choliba/releases';
const PACKAGE_ASSET = 'choliba-0.0.1-dev.tgz';
const GITHUB_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'choliba-update' };

/** The package files an installation leaves in the workspace: `choliba-0.0.1-dev.tgz`, `choliba-0.0.1-dev.62.tgz`… */
const PACKAGE_FILE = /^choliba-0\.0\.1-dev(\.\d+)?\.tgz(\.sha256)?$/;

/** Where `choliba update` writes: the result on stdout; a line of progress or of error on stderr. */
export interface UpdateIo {
  write(text: string): void;
  fail(line: string): void;
  /** How the versions' headings stand out: bold when the output takes color. */
  readonly bold: Emphasis;
}

interface Release {
  readonly title: string;
  readonly number: number;
  readonly body: string;
  readonly packageUrl: string;
  readonly hashUrl: string;
}

/** Why the update stopped, said to the person: the command then ends with code 1. */
class UpdateStop extends Error {}

/** `get` on the network: a request that does not leave, or that GitHub refuses, says so with its address. */
async function fetchFrom(runtime: Runtime, url: string): Promise<HttpResponse> {
  const response = await runtime.get(url, GITHUB_HEADERS).catch((error: unknown) => {
    throw new UpdateStop(`Sem acesso a ${url}: ${messageOf(error)}.`);
  });
  if (!response.ok) throw new UpdateStop(`O GitHub respondeu ${String(response.status)} para ${url}.`);
  return response;
}

function assetUrl(assets: unknown, name: string): string {
  const found = (Array.isArray(assets) ? assets : []).find(
    (asset: unknown) => typeof asset === 'object' && asset !== null && (asset as { name?: unknown }).name === name,
  ) as { browser_download_url?: unknown } | undefined;
  const url = found?.browser_download_url;
  if (typeof url !== 'string') throw new UpdateStop(`A release não tem o arquivo ${name}.`);
  return url;
}

/** The API's answer about the release, or why it cannot be read. */
function parsedRelease(text: string): { name?: unknown; body?: unknown; assets?: unknown } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch {
    // Said below, with the rest of what does not read as a release.
  }
  throw new UpdateStop('A API do GitHub respondeu algo que não é uma release.');
}

/** The current pre-release: its title (`0.0.1-dev.66 (2026-10-20)`), N, notes and the package's files. */
async function currentRelease(runtime: Runtime): Promise<Release> {
  const response = await fetchFrom(runtime, RELEASE_API);
  const release = parsedRelease(await response.text());
  const title = typeof release.name === 'string' ? release.name : '';
  const number = releaseNumber(title);
  if (number === undefined) throw new UpdateStop(`A release do choliba tem um título sem versão: "${title}".`);
  return {
    title,
    number,
    body: typeof release.body === 'string' ? release.body : '',
    packageUrl: assetUrl(release.assets, PACKAGE_ASSET),
    hashUrl: assetUrl(release.assets, `${PACKAGE_ASSET}.sha256`),
  };
}

/** The installed choliba, read from the workspace's `node_modules`; none when it is not there. */
export function installedManifest(root: string): PackageManifest | undefined {
  return findManifest(PACKAGE_NAME, [join(root, 'node_modules', PACKAGE_NAME)]);
}

/** The version as `--version` shows it, without the name: `0.0.1-dev.62+27dbedb`. */
function shown(manifest: PackageManifest | undefined): string {
  return versionLine(PACKAGE_NAME, manifest).slice(PACKAGE_NAME.length + 1);
}

/** The package, downloaded and checked against the release's SHA-256; a file that does not match is not kept. */
async function download(runtime: Runtime, release: Release, file: string): Promise<void> {
  const bytes = Buffer.from(await (await fetchFrom(runtime, release.packageUrl)).arrayBuffer());
  const expected = (await (await fetchFrom(runtime, release.hashUrl)).text()).trim().split(/\s+/)[0];
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) {
    throw new UpdateStop(
      `O pacote baixado não confere com o SHA-256 da release (${actual} ≠ ${String(expected)}): nada foi instalado.`,
    );
  }
  writeFileSync(file, bytes);
}

/** The package files of earlier installations in `root`, which the new one replaces. */
function earlierPackages(root: string, kept: string): readonly string[] {
  return readdirSync(root).filter((name) => PACKAGE_FILE.test(name) && name !== kept);
}

function newsLines(release: Release, since: number, bold: Emphasis): readonly string[] {
  const news = whatIsNew(release.body, since, bold);
  return news.length === 0 ? [] : ['', 'Novidades:', '', ...news, `Detalhes: ${RELEASES_PAGE}`];
}

/**
 * `choliba update`: the installed version against the current pre-release; with a newer one, its package downloaded
 * to `root`, checked against its SHA-256 and installed with `bun add --trust` (which runs `choliba setup`), then what
 * changed and what is new. `check` stops before downloading, saying what would come. Run from the sources, it refuses.
 */
export async function update(runtime: Runtime, root: string, check: boolean, io: UpdateIo): Promise<number> {
  if (basename(runtime.entryDir) === 'src') {
    io.fail('Este choliba roda do código-fonte, não de um pacote instalado: atualize com git pull.');
    return 1;
  }
  try {
    const before = installedManifest(root);
    const since = releaseNumber(before?.version ?? '') ?? -1;
    const release = await currentRelease(runtime);
    if (release.number <= since) {
      io.write(`O choliba já está na versão mais recente (${shown(before)}).\n`);
      return 0;
    }
    if (check) {
      const lines = [
        `Há uma versão nova: ${release.title} (instalada: ${shown(before)}).`,
        ...newsLines(release, since, io.bold),
      ];
      io.write(`${[...lines, '', 'Para atualizar: choliba update'].join('\n')}\n`);
      return 0;
    }
    const name = `choliba-0.0.1-dev.${String(release.number)}.tgz`;
    io.fail(`Baixando ${release.title}…`);
    await download(runtime, release, join(root, name));
    io.fail(`Instalando ${name}…`);
    // Bun's own lines stay out of the result on stdout; they show only when it fails.
    const added = runtime.capture(runtime.execPath, ['add', '--trust', `./${name}`], root);
    if (added.status !== 0) {
      const code = added.status ?? 1;
      io.fail(
        `${added.stderr.trim()}\nO bun add terminou com código ${String(code)}: o choliba continua em ${shown(before)}.`,
      );
      return code;
    }
    // The package files of the installations before it are no dependency any more.
    for (const earlier of earlierPackages(root, name)) rmSync(join(root, earlier), { force: true });
    const lines = [
      `Atualizado de ${shown(before)} para ${shown(installedManifest(root))}.`,
      ...newsLines(release, since, io.bold),
    ];
    io.write(`${lines.join('\n')}\n`);
    return 0;
  } catch (error) {
    if (!(error instanceof UpdateStop)) throw error;
    io.fail(error.message);
    return 1;
  }
}
