/**
 * `bun run release:notes [COMMIT]`: the notes of the pre-release, rebuilt from
 * git on every merge into master (default HEAD). The CI gives `TAG` (the
 * release's tag, `v<version>`), `GITHUB_REPOSITORY` and `GH_TOKEN`. The
 * "Destaques" come from the release PR, through `gh`: without it the notes
 * come out without them, with a warning on stderr.
 */

import { defineCommand, runCommand } from '../src/command/index';
import { environment, runProgram } from '../src/execute/process';
import { writeErr, writeOut } from '../src/output/stdio';
import {
  highlightsOf,
  releaseNotes,
  type Commit,
  type Release,
} from './release';

/** Time limit of one `git` or `gh` call, in milliseconds. */
const PROGRAM_TIMEOUT_MS = 60_000;
/** Biggest output of one call: a `git log` of a long history, in bytes. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
/** Separate the fields and the records of a `git log --format` (control characters, absent from messages). */
const FIELD = '\x1f';
const RECORD = '\x1e';

function call(executable: string, args: readonly string[]): Promise<string> {
  return runProgram(executable, args, {
    timeoutMs: PROGRAM_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  });
}

function records(output: string): readonly (readonly string[])[] {
  return output
    .split(RECORD)
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record !== '')
    .map((record) => record.split(FIELD));
}

/** The commits a merge brought: the second parent's that the first did not have, without merges. */
async function mergedCommits(
  previous: string,
  merged: string,
): Promise<readonly Commit[]> {
  const output = await call('git', [
    'log',
    '--no-merges',
    `--format=%H${FIELD}%s${FIELD}%b${RECORD}`,
    `${previous}..${merged}`,
  ]);
  return records(output).map(([hash = '', subject = '', body = '']) => ({
    hash,
    subject,
    body,
  }));
}

/**
 * The `version` of `package.json` as it was at `commit`; `undefined` when it had none (the root of the old monorepo
 * did not, and its releases follow another scheme of versions).
 */
async function versionAt(commit: string): Promise<string | undefined> {
  try {
    const manifest: unknown = JSON.parse(
      await call('git', ['show', `${commit}:package.json`]),
    );
    if (
      typeof manifest === 'object' &&
      manifest !== null &&
      'version' in manifest &&
      typeof manifest.version === 'string'
    ) {
      return manifest.version;
    }
  } catch {
    // No package.json at that commit: no version either.
  }
  return undefined;
}

async function main(
  commit: string,
  repository: string,
  tag: string,
  warn: (text: string) => void,
): Promise<string> {
  let warned = false;
  /** The release PR's "## Destaques"; without `gh` (or access), none, with one warning. */
  async function highlights(pullRequest: number): Promise<string | undefined> {
    try {
      const body = await call('gh', [
        'api',
        `repos/${repository}/pulls/${String(pullRequest)}`,
        '--jq',
        '.body',
      ]);
      return highlightsOf(body);
    } catch {
      if (!warned) {
        warn(
          'Sem acesso ao gh: as notas saem sem os Destaques dos PRs de release.',
        );
      }
      warned = true;
      return undefined;
    }
  }

  const format = ['%H', '%P', '%ad', '%s'].join(FIELD) + RECORD;
  const merges = records(
    await call('git', [
      'log',
      '--first-parent',
      '--merges',
      '--date=short',
      `--format=${format}`,
      commit,
    ]),
  );
  const releases: Release[] = [];
  for (const [hash = '', parents = '', date = '', subject = ''] of merges) {
    const [previous = '', merged = ''] = parents.split(' ');
    const found = /^Merge pull request #(\d+)/.exec(subject)?.[1];
    const pullRequest = found === undefined ? undefined : Number(found);
    const version = await versionAt(hash);
    // The notes are of this package's releases: an older merge with no version is of another scheme, and so is
    // everything before it.
    if (version === undefined) break;
    releases.push({
      hash,
      previous,
      date,
      version,
      pullRequest,
      highlights:
        pullRequest === undefined ? undefined : await highlights(pullRequest),
      commits: await mergedCommits(previous, merged),
    });
  }
  return releaseNotes(releases, {
    repoUrl: `https://github.com/${repository}`,
    tag,
  });
}

await runCommand(
  defineCommand({
    name: 'release:notes',
    description:
      'Gera as notas da pré-release a partir do git: um merge de release na master por seção, os Destaques do PR e os commits por tipo.',
    args: {
      commit: { description: 'Até onde ler o histórico (padrão: HEAD)' },
    },
    run: async ({ args }) => {
      const env = environment();
      const notes = await main(
        args.commit ?? 'HEAD',
        env['GITHUB_REPOSITORY'] ?? 'choliba/choliba',
        env['TAG'] ?? 'v0.1.0',
        (text) => writeErr(`${text}\n`),
      );
      writeOut(notes);
    },
  }),
);
