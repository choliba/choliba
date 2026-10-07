import { mcpServersMap } from '../../mcps/mcps';
import { absolutePermissions } from '../../runs/permissions';
import { assertArgvFits, runPlaceOf, wrapInstructions } from '../../runs/prompt';
import { runToolCommands, runToolsOf } from '../../runs/run-tools/run-tools';
import { createStreamJsonParser } from '../stream-json';
import { Injectable } from '@nestjs/common';

import { AgentProvider } from '../agent-provider';
import type { PlanContentContext, PlannedFile, ProviderRequest, StreamParser } from '../interfaces/provider.interface';
import { RegisterAgentProvider } from '../register-agent-provider';
import { applyCursorMcpServers, applyCursorPermissions, planCursorMcpServers, planCursorPermissions } from './cli-json';
import { clearCursorState } from './cursor-state';
import { type CursorPermissions, cursorPermissions, readDir, undeclaredMcpTokens, userMcpServers } from './permissions';

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
  const prompt = `${wrapInstructions(request.agent, request.skillsInstruction, runPlaceOf(request))}\n\n${request.userPrompt}`;
  // `--workspace` is the project root: that is where cursor-agent reads `.cursor/cli.json` and
  // `.cursor/mcp.json`. Without them there it falls back to `~/.cursor/cli-config.json`.
  const args: string[] = [
    '-p',
    prompt,
    '--trust',
    '--output-format',
    'stream-json',
    '--workspace',
    request.workspaceRoot,
  ];
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

/**
 * The agent's permissions and MCP servers, written into `.cursor/cli.json` and `.cursor/mcp.json` of the
 * workspace root (the permissions always: even an agent that declares none is denied the rest) — the same
 * folder `--workspace` names, so cursor-agent finds and honours them. Undone in reverse order, so the
 * `.cursor/` dir created for the first file is removed only once both are gone, and last what cursor-agent
 * may still have kept for the run dir in `~/.cursor` (`clearCursorState`). The run tools' scripts are
 * already on disk (`runAgent` writes them first), so the complement of what may be written names them too.
 */
function requestPermissions(request: ProviderRequest): CursorPermissions {
  const mcpServers = request.mcpServers ?? [];
  const permissions = cursorPermissions(
    absolutePermissions(request.agent.permissions, request.workspaceRoot),
    request.policy,
    request.workspaceRoot,
    request.runDir,
    mcpServers,
    readDir,
    runToolCommands(runToolsOf(request)),
  );
  return { ...permissions, deny: [...permissions.deny, ...undeclaredMcpTokens(userMcpServers(), mcpServers)] };
}

function prepareWorkspace(request: ProviderRequest): () => void {
  const mcpServers = request.mcpServers ?? [];
  const permissions = requestPermissions(request);
  const root = request.workspaceRoot;
  const restores: (() => void)[] = [
    () => {
      clearCursorState(request.runDir);
    },
  ];
  const restoreAll = (): void => {
    for (const restore of [...restores].reverse()) {
      restore();
    }
  };
  restores.push(applyCursorPermissions(root, permissions));
  if (mcpServers.length > 0) {
    try {
      restores.push(applyCursorMcpServers(root, mcpServersMap(mcpServers)));
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
  const root = request.workspaceRoot;
  const permissions = planCursorPermissions(root, requestPermissions(request));
  return mcpServers.length === 0
    ? [permissions]
    : [permissions, planCursorMcpServers(root, mcpServersMap(mcpServers))];
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
