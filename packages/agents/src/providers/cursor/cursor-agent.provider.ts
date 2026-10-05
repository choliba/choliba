import { mcpServersMap } from '../../mcps/mcps';
import {
  applyDeleteBridge,
  deleteBridgePath,
  planDeleteBridge,
  shouldApplyDeleteBridge,
} from '../../runs/delete-bridge';
import { absolutePermissions } from '../../runs/permissions';
import { assertArgvFits, wrapInstructions } from '../../runs/prompt';
import { createStreamJsonParser } from '../stream-json';
import { Injectable } from '@nestjs/common';

import { AgentProvider } from '../agent-provider';
import type { PlanContentContext, PlannedFile, ProviderRequest, StreamParser } from '../interfaces/provider.interface';
import { RegisterAgentProvider } from '../register-agent-provider';
import { applyCursorMcpServers, applyCursorPermissions, planCursorMcpServers, planCursorPermissions } from './cli-json';
import { type CursorPermissions, cursorPermissions, readDir } from './permissions';

function resolvePlanContent(context: PlanContentContext): string | undefined {
  const content = context.planMarkdown?.trim();
  return content === '' ? undefined : content;
}

/**
 * Extra flags for `request.mode`/`.policy` — one early return per case, no fallthrough. Cases
 * are mutually exclusive; `edits` under `execute` needs nothing extra (cursor-agent's default).
 */
function policyArgs(request: ProviderRequest): readonly string[] {
  if (request.mode === 'ask' || request.mode === 'plan') {
    return ['--mode', request.mode];
  }
  if (request.policy === 'read-only') {
    // cursor-agent has no execute+read-only mode of its own; `ask` is the closest fit. NOT YET
    // confirmed with a real run that `ask` actually blocks writes under `-p` — `--help` says
    // `-p` "has access to all tools, including write and shell". See the package README's
    // "known gaps" before trusting this for anything sensitive.
    return ['--mode', 'ask'];
  }
  return [];
}

/**
 * cursor-agent has no `--system-prompt` equivalent (checked via `cursor-agent --help`: only
 * a positional prompt, `--mode`, `--model`, `--sandbox`, `--force`/`--yolo`, `--trust`,
 * `--workspace`, `--add-dir`, `-p`/`--output-format`). The instructions are inlined at the
 * front of the prompt instead of appended as a separate flag.
 */
function buildArgs(request: ProviderRequest): readonly string[] {
  const prompt = `${wrapInstructions(request.agent, request.skillsInstruction, {
    runDir: request.runDir,
    root: request.workspaceRoot,
  })}\n\n${request.userPrompt}`;
  const args: string[] = ['-p', prompt, '--trust', '--output-format', 'stream-json', '--workspace', request.runDir];
  if (request.model !== undefined) {
    args.push('--model', request.model);
  }
  const extra = policyArgs(request);
  args.push(...extra);
  // policy === 'edits' under execute: no extra flag — cursor-agent's default behavior.
  // A headless run cannot answer the approval prompt of the servers agent.yaml lists. The flag
  // approves every configured server, the user's own included: cursor has no way to load only some.
  if ((request.mcpServers ?? []).length > 0 && !extra.includes('--approve-mcps')) {
    args.push('--approve-mcps');
  }
  for (const dir of request.addDirs) {
    args.push('--add-dir', dir);
  }
  assertArgvFits(args);
  return args;
}

function resolvedPermissions(request: ProviderRequest) {
  return absolutePermissions(request.agent.permissions, request.workspaceRoot);
}

function deleteBridgeFor(request: ProviderRequest): string | undefined {
  const permissions = resolvedPermissions(request);
  if (!shouldApplyDeleteBridge(permissions.allowDelete, request.policy)) {
    return undefined;
  }
  return deleteBridgePath(request.runDir);
}

function requestPermissions(request: ProviderRequest): CursorPermissions {
  return cursorPermissions(
    resolvedPermissions(request),
    request.policy,
    request.workspaceRoot,
    request.runDir,
    request.mcpServers ?? [],
    readDir,
    { deleteBridge: deleteBridgeFor(request) },
  );
}

function prepareWorkspace(request: ProviderRequest): () => void {
  const mcpServers = request.mcpServers ?? [];
  const permissions = resolvedPermissions(request);
  const restores: (() => void)[] = [];
  const restoreAll = (): void => {
    for (const restore of [...restores].reverse()) {
      restore();
    }
  };
  if (shouldApplyDeleteBridge(permissions.allowDelete, request.policy)) {
    restores.push(applyDeleteBridge(request.runDir, permissions.allowDelete, permissions.denyDelete));
  }
  restores.push(applyCursorPermissions(request.runDir, requestPermissions(request)));
  if (mcpServers.length > 0) {
    try {
      restores.push(applyCursorMcpServers(request.runDir, mcpServersMap(mcpServers)));
    } catch (error) {
      restoreAll();
      throw error;
    }
  }
  return restoreAll;
}

/** What `prepareWorkspace` would write, for `--dry-run --show-prompt`: `cli.json` always, `mcp.json` with servers. */
function previewWorkspace(request: ProviderRequest): readonly PlannedFile[] {
  const mcpServers = request.mcpServers ?? [];
  const permissions = resolvedPermissions(request);
  const files: PlannedFile[] = [];
  if (shouldApplyDeleteBridge(permissions.allowDelete, request.policy)) {
    files.push(planDeleteBridge(request.runDir, permissions.allowDelete, permissions.denyDelete));
  }
  files.push(planCursorPermissions(request.runDir, requestPermissions(request)));
  if (mcpServers.length > 0) {
    files.push(planCursorMcpServers(request.runDir, mcpServersMap(mcpServers)));
  }
  return files;
}

/** Cursor's agent CLI (`agent`, `cursor-agent` or `cursor agent`, whichever is installed). */
@RegisterAgentProvider()
@Injectable()
export class CursorAgentProvider extends AgentProvider {
  readonly id = 'cursor';
  readonly binaries = [['agent'], ['cursor-agent'], ['cursor', 'agent']];
  /** First in `auto`. */
  readonly autoPriority = 1;

  buildArgs(request: ProviderRequest): readonly string[] {
    return buildArgs(request);
  }

  createParser(): StreamParser {
    return createStreamJsonParser({
      planFromExitPlanMode: false,
      planFromCreatePlanToolCall: true,
      toolCallEvents: true,
    });
  }

  override resolvePlanContent(context: PlanContentContext): string | undefined {
    return resolvePlanContent(context);
  }

  override prepareWorkspace(request: ProviderRequest): () => void {
    return prepareWorkspace(request);
  }

  override previewWorkspace(request: ProviderRequest): readonly PlannedFile[] {
    return previewWorkspace(request);
  }
}
