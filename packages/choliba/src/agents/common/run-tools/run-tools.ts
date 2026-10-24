import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR = 'CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR';
import { denyExceptions, isException } from '@choliba/sandbox';
import {
  DELETE,
  runToolsOf,
  shortcutPath,
  type PlannedFile,
  type ProviderRequest,
  type RunToolName,
} from '@choliba/engine';

import { type AgentPermissions, absolutePermissions } from '@choliba/domain';
import { askExchangeDir, askScript } from './ask-tool';
import { deleteScript } from './delete-tool';
import { DEFAULT_PLAYWRIGHT_OUTPUT_DIR, playwrightScript } from './playwright-tool';

/** What a run tool's script is written from. */
interface ScriptContext {
  /** Already absolute (`absolutePermissions`). */
  readonly permissions: AgentPermissions;
  readonly workspaceRoot: string;
  /** The run folder, which holds the `ask` exchange folder. */
  readonly runDir: string;
  readonly config: Readonly<Record<string, string | undefined>>;
}

interface RunToolScript {
  readonly script: (context: ScriptContext) => string;
}

/** Where the Playwright run tools write: `CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR`, or `.cache/playwright-cli`. */
function playwrightOutputDir(config: ScriptContext['config']): string {
  return config[CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR] ?? DEFAULT_PLAYWRIGHT_OUTPUT_DIR;
}

/**
 * Every run tool's script: choliba writes it next to a run folder for the agent. The names, purposes and
 * paths live in `@choliba/engine`.
 */
const RUN_TOOL_SCRIPTS: Readonly<Record<RunToolName, RunToolScript>> = {
  [DELETE]: {
    script: ({ permissions }) =>
      deleteScript(
        permissions.allowDelete,
        permissions.denyDelete.filter((path) => !isException(path)),
        denyExceptions(permissions.denyDelete),
      ),
  },
  'playwright-cli': {
    script: ({ workspaceRoot, config }) =>
      playwrightScript({ command: 'cli', workspaceRoot, outputDir: playwrightOutputDir(config) }),
  },
  'playwright-trace': {
    script: ({ workspaceRoot, config }) =>
      playwrightScript({ command: 'trace', workspaceRoot, outputDir: playwrightOutputDir(config) }),
  },
  ask: {
    script: ({ runDir }) => askScript(askExchangeDir(runDir)),
  },
};

/** The scripts of the run tools of `request`, writing nothing (`--dry-run --show-prompt` shows them). */
export function planRunTools(
  request: ProviderRequest,
  config: Readonly<Record<string, string | undefined>>,
): readonly PlannedFile[] {
  const context: ScriptContext = {
    permissions: absolutePermissions(request.agent.permissions, request.workspaceRoot),
    workspaceRoot: request.workspaceRoot,
    runDir: request.runDir,
    config,
  };
  return runToolsOf(request).flatMap((tool) => [
    { path: tool.path, content: RUN_TOOL_SCRIPTS[tool.name].script(context) },
    { path: shortcutPath(tool), content: shortcutScript(tool.path) },
  ]);
}

/** A shortcut's script: it runs the tool's own script, with what it was given. */
function shortcutScript(script: string): string {
  return `#!/bin/sh\nexec ${JSON.stringify(script)} "$@"\n`;
}

/** Writes `files` as executables and returns the restore that removes them, safe to call more than once. */
export function applyRunTools(files: readonly PlannedFile[]): () => void {
  // The folders it makes (the shortcuts'), removed with the files.
  const made = [...new Set(files.map((file) => dirname(file.path)))].filter((folder) => !existsSync(folder));
  for (const folder of made) mkdirSync(folder, { recursive: true });
  for (const file of files) {
    writeFileSync(file.path, file.content, 'utf8');
    chmodSync(file.path, 0o755);
  }
  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    for (const file of files) {
      rmSync(file.path, { force: true });
    }
    for (const folder of made) rmSync(folder, { recursive: true, force: true });
  };
}
