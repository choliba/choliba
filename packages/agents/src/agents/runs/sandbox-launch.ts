import { existsSync, mkdirSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR } from '@choliba/core';
import { resolveLocations, resolveTicketRunsFolder, resolveTicketRunsRoot } from '@choliba/projects';
import {
  type ContainerUser,
  createSandboxBackend,
  type DiskFacts,
  readDir,
  type Sandbox,
  type SandboxPath,
  type SandboxPlace,
} from '@choliba/sandbox';

import {
  absolutePermissions,
  DEFAULT_PLAYWRIGHT_OUTPUT_DIR,
  runToolsOf,
  type PlannedFile,
  type ProviderRequest,
} from '../../common';
import { definedConfig } from '../agent-dirs';

type Config = Readonly<Record<string, string | undefined>>;

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
  readonly request: ProviderRequest;
  /** The run tools' scripts and what the provider writes for the run (cursor's `mcp.json`): read in the container. */
  readonly files: readonly PlannedFile[];
  readonly config: Config;
}

/** The disk and the workspace's owner; specs pass their own. */
export interface LaunchDisk extends DiskFacts {
  readonly owner: (path: string) => ContainerUser;
  readonly ensureDir: (path: string) => void;
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
};

function fromRoot(path: string, root: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

/**
 * Where the session's own commands write, outside the agent's permissions: the Playwright run tools' output folder,
 * when the agent has one of them, and the project's `ticket-runs/` (`choliba run tests` keeps its reports there). Created
 * first, so the container opens these folders and not the ones around them.
 */
function outputFolders(request: ProviderRequest, config: Config): readonly string[] {
  const root = request.workspaceRoot;
  const browser = runToolsOf(request).some((tool) => tool.name !== 'delete');
  const playwright = browser
    ? [fromRoot(config[CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR] ?? DEFAULT_PLAYWRIGHT_OUTPUT_DIR, root)]
    : [];
  if (request.project === undefined) return playwright;
  const ticketRuns = resolveTicketRunsRoot(resolveLocations(root, config));
  return [...playwright, resolveTicketRunsFolder(ticketRuns, request.project.name)];
}

/**
 * How to start the provider for `input.request`. On this machine, `bwrap` with the same mounts as the container.
 * In a container (`CHOL_SANDBOX=docker`), `docker run` with those mounts, the installed packages (`node_modules`, which
 * the run tools and `bunx choliba` load) and the output folders, as the workspace's owner, and the provider's
 * credentials by name.
 */
export function launchFor(input: LaunchInput, disk: LaunchDisk = realDisk): Launch {
  const { request, config } = input;
  const root = request.workspaceRoot;
  const outputs = outputFolders(request, config);
  outputs.forEach(disk.ensureDir);
  const reach = {
    permissions: absolutePermissions(request.agent.permissions, root),
    policy: request.policy,
    addDirs: request.addDirs,
    runDir: request.runDir,
    alsoRead: [...input.files.map((file) => file.path), join(root, 'node_modules')],
    alsoWrite: outputs,
  };
  const backend = createSandboxBackend(input.sandbox, {
    user: () => disk.owner(root),
    environment: definedConfig(config),
    disk,
  });
  return backend.plan({ command: input.command, reach });
}
