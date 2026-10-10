import { existsSync, mkdirSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR } from '@choliba/core';
import { resolveLocations, resolveTicketRunsFolder, resolveTicketRunsRoot } from '@choliba/projects';

import {
  absolutePermissions,
  containerMounts,
  DEFAULT_PLAYWRIGHT_OUTPUT_DIR,
  dockerRunArgs,
  presentCredentials,
  readDir,
  runToolsOf,
  type ContainerMount,
  type ContainerUser,
  type DiskFacts,
  type PlannedFile,
  type ProviderRequest,
  type Sandbox,
} from '../../common';
import { definedConfig } from '../agent-dirs';

type Config = Readonly<Record<string, string | undefined>>;

/** How the provider's process starts: its command line and, in a container, the environment `docker` reads. */
export interface Launch {
  readonly command: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** What the container mounts; empty on this machine. */
  readonly mounts: readonly ContainerMount[];
  /** Paths the agent may reach that are the image's own folders, so not mounted; empty on this machine. */
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
 * when the agent has one of them, and the project's `ticket-runs/` (`choliba tests` keeps its reports there). Created
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
 * How to start the provider for `input.request`. On this machine, the command as it is. In a container
 * (`CHOL_SANDBOX=docker`), `docker run` with the paths the run reaches, the installed packages (`node_modules`, which
 * the run tools and `bunx choliba` load) and the output folders, as the workspace's owner, and the provider's
 * credentials by name.
 */
export function launchFor(input: LaunchInput, disk: LaunchDisk = realDisk): Launch {
  if (input.sandbox.kind === 'local') return { command: input.command, mounts: [], skipped: [] };
  const { request, config } = input;
  const root = request.workspaceRoot;
  const outputs = outputFolders(request, config);
  outputs.forEach(disk.ensureDir);
  const { mounts, skipped } = containerMounts(
    {
      permissions: absolutePermissions(request.agent.permissions, root),
      policy: request.policy,
      addDirs: request.addDirs,
      runDir: request.runDir,
      alsoRead: [...input.files.map((file) => file.path), join(root, 'node_modules')],
      alsoWrite: outputs,
    },
    disk,
  );
  return {
    command: dockerRunArgs({
      image: input.sandbox.image,
      mounts,
      cwd: request.runDir,
      user: disk.owner(root),
      env: presentCredentials(config),
      command: input.command,
    }),
    env: definedConfig(config),
    mounts,
    skipped,
  };
}
