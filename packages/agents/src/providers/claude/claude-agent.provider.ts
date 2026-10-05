import { mcpServersMap } from '../../mcps/mcps';
import { applyDeleteBridge, deleteBridgePath, shouldApplyDeleteBridge } from '../../runs/delete-bridge';
import { absolutePermissions } from '../../runs/permissions';
import { assertArgvFits, wrapInstructions } from '../../runs/prompt';
import { createStreamJsonParser } from '../stream-json';
import { Injectable } from '@nestjs/common';

import { AgentProvider } from '../agent-provider';
import type { ProviderRequest, StreamParser } from '../interfaces/provider.interface';
import { RegisterAgentProvider } from '../register-agent-provider';
import { claudePermissionArgs } from './permissions';

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

function buildArgs(request: ProviderRequest): readonly string[] {
  const args: string[] = [
    '-p',
    request.userPrompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--append-system-prompt',
    wrapInstructions(request.agent, request.skillsInstruction, {
      runDir: request.runDir,
      root: request.workspaceRoot,
    }),
  ];
  if (request.model !== undefined) {
    args.push('--model', request.model);
  }
  const mcpServers = request.mcpServers ?? [];
  const permissions = claudePermissionArgs(
    resolvedPermissions(request),
    request.policy,
    mcpServers,
    deleteBridgeFor(request),
  );
  args.push('--permission-mode', permissions.permissionMode);
  args.push('--tools', permissions.tools.join(','));
  // Only the MCP servers agent.yaml lists, whatever the policy: without `--strict-mcp-config` the
  // user's own servers and connectors (which `--tools` does not remove) would join the session.
  args.push('--strict-mcp-config');
  // Auto-memory would let the session read and write ~/.claude/projects/<run>/memory/, outside what the
  // permissions allow, and each run's folder is new, so nothing it saves would ever be read again.
  args.push('--settings', JSON.stringify({ autoMemoryEnabled: false }));
  // Variadic flags go last: a positional prompt placed after one would be swallowed by it.
  // There is none here (the prompt is already first, right after -p), but keeping this order
  // means a future flag inserted above can never accidentally end up after these.
  if (request.addDirs.length > 0) {
    args.push('--add-dir', ...request.addDirs);
  }
  if (mcpServers.length > 0) {
    args.push('--mcp-config', JSON.stringify({ mcpServers: mcpServersMap(mcpServers) }));
  }
  if (permissions.allowedTools.length > 0) {
    args.push('--allowedTools', ...permissions.allowedTools);
  }
  if (permissions.disallowedTools.length > 0) {
    args.push('--disallowedTools', ...permissions.disallowedTools);
  }
  assertArgvFits(args);
  return args;
}

function prepareWorkspace(request: ProviderRequest): () => void {
  const permissions = resolvedPermissions(request);
  if (!shouldApplyDeleteBridge(permissions.allowDelete, request.policy)) {
    return () => undefined;
  }
  return applyDeleteBridge(request.runDir, permissions.allowDelete, permissions.denyDelete);
}

/** Claude Code (`claude -p … --output-format stream-json`). */
@RegisterAgentProvider()
@Injectable()
export class ClaudeAgentProvider extends AgentProvider {
  readonly id = 'claude';
  readonly binaries = [['claude']];
  /** After cursor in `auto`. */
  readonly autoPriority = 2;

  buildArgs(request: ProviderRequest): readonly string[] {
    return buildArgs(request);
  }

  createParser(): StreamParser {
    return createStreamJsonParser({ planFromExitPlanMode: true });
  }

  override prepareWorkspace(request: ProviderRequest): () => void {
    return prepareWorkspace(request);
  }
}
