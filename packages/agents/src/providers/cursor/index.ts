import { mcpServersMap } from '../../mcps';
import { assertArgvFits, wrapInstructions } from '../../prompt';
import { createStreamJsonParser } from '../stream-json';
import type { PlanContentContext, ProviderAdapter, ProviderRequest } from '../provider.types';
import { applyCursorMcpServers, applyCursorPermissions } from './cli-json';
import { cursorPermissions } from './permissions';

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
  const prompt = `${wrapInstructions(request.agent, request.skillsInstruction)}\n\n${request.userPrompt}`;
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
 * The agent's declared permissions and MCP servers, written into `.cursor/cli.json` and
 * `.cursor/mcp.json` for the run (nothing when it declares neither). Undone in reverse order, so
 * the `.cursor/` dir created for the first file is removed only once both are gone.
 */
function prepareWorkspace(request: ProviderRequest): () => void {
  const mcpServers = request.mcpServers ?? [];
  const permissions = cursorPermissions(request.agent.permissions, request.policy, request.workspaceRoot, mcpServers);
  const restores: (() => void)[] = [];
  const restoreAll = (): void => {
    for (const restore of [...restores].reverse()) {
      restore();
    }
  };
  if (permissions.allow.length > 0 || permissions.deny.length > 0) {
    restores.push(applyCursorPermissions(request.workspaceRoot, permissions));
  }
  if (mcpServers.length > 0) {
    try {
      restores.push(applyCursorMcpServers(request.workspaceRoot, mcpServersMap(mcpServers)));
    } catch (error) {
      restoreAll();
      throw error;
    }
  }
  return restoreAll;
}

export const cursorProvider: ProviderAdapter = {
  id: 'cursor',
  binaries: [['agent'], ['cursor-agent'], ['cursor', 'agent']],
  buildArgs,
  prepareWorkspace,
  createParser: () =>
    createStreamJsonParser({ planFromExitPlanMode: false, planFromCreatePlanToolCall: true, toolCallEvents: true }),
  resolvePlanContent,
};
