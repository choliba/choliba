import { existsSync, mkdirSync, realpathSync, statSync, symlinkSync, unlinkSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join } from 'node:path';

import { absolutePermissions } from '@choliba/domain';
import { resolveTicketRunsFolder, resolveTicketRunsRoot } from '@choliba/runner';
import {
  agentURL,
  type ContainerUser,
  createSandboxBackend,
  type DiskFacts,
  readDir,
  type Sandbox,
  type SandboxPath,
  type SandboxPlace,
  SandboxEnforcementError,
  type SandboxProgram,
} from '@choliba/sandbox';

import { runToolShortcuts } from '../common';
import { runToolsOf } from '../guards';
import type { PlannedFile, ProviderRequest, ResolvedProvider } from '../ports';
import { locationsOf } from './run-context';
import { definedConfig } from '../common';

type Config = Readonly<Record<string, string | undefined>>;

const DEFAULT_PATH = '/usr/local/bin:/usr/bin:/bin';
const DEFAULT_PLAYWRIGHT_OUTPUT_DIR = '.cache/playwright-cli';
const CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR = 'CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR';

/** The session's PATH with its run-tool shortcuts first; containers keep their own conventional executable paths. */
function sessionPath(input: LaunchInput): string {
  const inherited = input.sandbox.kind === 'local' ? input.config['PATH'] : undefined;
  return `${runToolShortcuts(input.request.runDir)}${delimiter}${inherited ?? DEFAULT_PATH}`;
}

/** How the provider's process starts: its command line and, in a container, the environment `docker` reads. */
export interface Launch {
  readonly command: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** Where the provider runs: this machine, or a named container of an image. */
  readonly place: SandboxPlace;
  /** What the sandbox mounts; empty when nothing on disk was reachable. */
  readonly paths: readonly SandboxPath[];
  /** Paths the agent may reach that stay the system's or the image's, so not mounted on their own. */
  readonly skipped: readonly string[];
}

/** What a launch is planned from: the run, what it writes next to it, and the workspace's configuration. */
export interface LaunchInput {
  readonly sandbox: Sandbox;
  readonly command: readonly string[];
  readonly provider: ResolvedProvider;
  readonly request: ProviderRequest;
  /** The run tools' scripts and what the provider writes for the run (cursor's `mcp.json`): read in the container. */
  readonly files: readonly PlannedFile[];
  readonly config: Config;
}

/** The disk and the workspace's owner; specs pass their own. */
export interface LaunchDisk extends DiskFacts {
  readonly owner: (path: string) => ContainerUser;
  readonly ensureDir: (path: string) => void;
  /** A link at `path` that points at `target`, so a short name on `PATH` reaches the resolved executable. */
  readonly link: (target: string, path: string) => void;
  readonly realpath: (path: string) => string;
  /** The `bun` running choliba: the run tools' scripts start with `#!/usr/bin/env bun`. */
  readonly runtime: string;
}

export const realDisk: LaunchDisk = {
  exists: existsSync,
  isDirectory: (path) => existsSync(path) && statSync(path).isDirectory(),
  read: readDir,
  owner: (path) => {
    const stat = statSync(path);
    return { uid: stat.uid, gid: stat.gid };
  },
  ensureDir: (path) => {
    mkdirSync(path, { recursive: true });
  },
  link: (target, path) => {
    if (existsSync(path)) unlinkSync(path);
    symlinkSync(target, path);
  },
  realpath: realpathSync,
  runtime: process.execPath,
};

/**
 * The `bun` running choliba and, when it sits beside it, its `bunx`: the run tools start with `env bun`, and an agent's
 * commands (`bun choliba run tests`) call `bun`, and another agent's may call `bunx`, both from a home the sandbox empties. `bunx` is `bun` under another
 * name, so mounting its path gives the sandbox the same binary there.
 */
function runtimeFiles(disk: LaunchDisk): readonly string[] {
  const bunx = join(dirname(disk.runtime), 'bunx');
  return disk.exists(bunx) ? [disk.runtime, bunx] : [disk.runtime];
}

function localProgram(provider: ResolvedProvider, disk: LaunchDisk): SandboxProgram {
  let executable: string;
  try {
    executable = disk.realpath(provider.executable);
  } catch {
    throw new SandboxEnforcementError(
      `O provider local não foi encontrado: ${provider.command[0] ?? 'comando vazio'}.`,
    );
  }
  return {
    executable,
    readOnly: [...provider.adapter.localReadOnly(executable), ...runtimeFiles(disk)],
    credentials: provider.adapter.credentials,
    credentialHelp: provider.adapter.credentialHelp,
  };
}

/**
 * The provider's short name (`claude`, `agent`) as a link in the run's shortcuts folder, which goes first on PATH.
 * The home that held `~/.local/bin` is empty inside bwrap, so `execvp("claude")` would miss it without this.
 */
function providerShortcut(runDir: string, name: string, executable: string, disk: LaunchDisk): string {
  const shortcuts = runToolShortcuts(runDir);
  disk.ensureDir(shortcuts);
  const path = join(shortcuts, name);
  disk.link(executable, path);
  return path;
}

function providerShortcutOf(input: LaunchInput, program: SandboxProgram, disk: LaunchDisk): readonly string[] {
  const [name] = input.provider.command;
  if (name === undefined || name === '') return [];
  return [providerShortcut(input.request.runDir, name, program.executable, disk)];
}

/** PATH for this session: always on this machine (the provider's short name lives in the shortcuts folder). */
function pathVariables(input: LaunchInput): Readonly<Record<string, string>> {
  if (input.sandbox.kind === 'local' || runToolsOf(input.request).length > 0) {
    return { PATH: sessionPath(input) };
  }
  return {};
}

function fromRoot(path: string, root: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

/** Whether the agent has a Playwright run tool (`playwright-cli`, `playwright-trace`), which opens a browser. */
function usesBrowser(request: ProviderRequest): boolean {
  return runToolsOf(request).some((tool) => tool.name !== 'delete');
}

/**
 * Where Playwright keeps its browsers on this machine: `PLAYWRIGHT_BROWSERS_PATH`, else `~/.cache/ms-playwright`.
 * `PLAYWRIGHT_BROWSERS_PATH=0` keeps them in `node_modules`, which a run already reads.
 */
function browsersFolder(config: Config): string | undefined {
  const set = config['PLAYWRIGHT_BROWSERS_PATH'];
  if (set === '0') return undefined;
  if (set !== undefined && set !== '') return set;
  const home = config['HOME'];
  return home === undefined ? undefined : join(home, '.cache', 'ms-playwright');
}

/**
 * The browsers the Playwright run tools open on this machine (`playwright-trace snapshot`): the local sandbox hides the
 * home they are kept in, so their folder comes back read-only. None in a container, whose image has its own, nor
 * without a Playwright run tool or the folder.
 */
function browserFolders(input: LaunchInput, disk: LaunchDisk): readonly string[] {
  if (input.sandbox.kind !== 'local' || !usesBrowser(input.request)) return [];
  const folder = browsersFolder(input.config);
  return folder !== undefined && disk.exists(folder) ? [folder] : [];
}

/**
 * Where `playwright-cli` keeps the browser it leaves open between two commands, in a local run with a Playwright run
 * tool: `ms-playwright/daemon` and `ms-playwright/b` of the cache folder (`XDG_CACHE_HOME`, else `~/.cache`), wherever
 * the browsers are. Written, while the browsers stay read-only.
 */
function browserState(input: LaunchInput): readonly string[] {
  if (input.sandbox.kind !== 'local' || !usesBrowser(input.request)) return [];
  const { XDG_CACHE_HOME: set, HOME: home } = input.config;
  const cache = set !== undefined && set !== '' ? set : home === undefined ? undefined : join(home, '.cache');
  return cache === undefined ? [] : ['daemon', 'b'].map((folder) => join(cache, 'ms-playwright', folder));
}

/**
 * Where the session's own commands write, outside the agent's permissions: the Playwright run tools' output folder,
 * when the agent has one of them, and the project's `ticket-runs/` (`choliba run tests` keeps its reports there). Created
 * first, so the container opens these folders and not the ones around them.
 */
function outputFolders(request: ProviderRequest, config: Config): readonly string[] {
  const root = request.workspaceRoot;
  const playwright = usesBrowser(request)
    ? [fromRoot(config[CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR] ?? DEFAULT_PLAYWRIGHT_OUTPUT_DIR, root)]
    : [];
  if (request.project === undefined) return playwright;
  const ticketRuns = resolveTicketRunsRoot(locationsOf(config));
  return [...playwright, resolveTicketRunsFolder(ticketRuns, request.project.name)];
}

/**
 * How to start the provider for `input.request`. On this machine, `bwrap` with the same mounts as the container.
 * In a container (`CHOL_SANDBOX=docker`), `docker run` with those mounts, the installed packages (`node_modules`, which
 * the run tools and `bun choliba` load) and the output folders, as the workspace's owner, and the provider's
 * credentials by name.
 */
export function launchFor(input: LaunchInput, disk: LaunchDisk = realDisk): Launch {
  const { request, config } = input;
  const root = request.workspaceRoot;
  const outputs = [...outputFolders(request, config), ...browserState(input)];
  outputs.forEach(disk.ensureDir);
  const program = input.sandbox.kind === 'local' ? localProgram(input.provider, disk) : undefined;
  const shortcut = program === undefined ? [] : providerShortcutOf(input, program, disk);
  const reach = {
    permissions: absolutePermissions(request.agent.permissions, root),
    policy: request.policy,
    addDirs: request.addDirs,
    runDir: request.runDir,
    alsoRead: [
      ...input.files.map((file) => file.path),
      join(root, 'node_modules'),
      ...browserFolders(input, disk),
      ...shortcut,
    ],
    alsoWrite: outputs,
  };
  const backend = createSandboxBackend(input.sandbox, {
    user: () => disk.owner(root),
    environment: definedConfig(config),
    disk,
  });
  const providerVariables = input.provider.adapter.variables?.({
    request,
    config,
    reachable: (url) => agentURL(url, input.sandbox),
  });
  const variables = { ...providerVariables, ...pathVariables(input) };
  return backend.plan({
    command: input.command,
    ...(program === undefined ? {} : { program }),
    ...(Object.keys(variables).length === 0 ? {} : { variables }),
    reach,
  });
}
