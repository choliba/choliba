import { absolutePermissions, mcpServersMap } from '@choliba/domain';
import {
  AgentProvider,
  assertArgvFits,
  runPlaceOf,
  runToolCommands,
  runToolsOf,
  wrapInstructions,
  type ProviderRequest,
  type ProviderVariablesInput,
  type StreamParser,
} from '@choliba/engine';

import { createStreamJsonParser } from '../common';
import { claudePermissionArgs } from './claude-permissions';

function buildArgs(request: ProviderRequest): readonly string[] {
  // The task is not here: it is the first message on stdin (`inputMessage`), where the person's messages follow.
  const args: string[] = [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--append-system-prompt',
    wrapInstructions(request.agent, request.skillsInstruction, runPlaceOf(request)),
  ];
  if (request.model !== undefined) {
    args.push('--model', request.model);
  }
  const mcpServers = request.mcpServers ?? [];
  const permissions = claudePermissionArgs(
    absolutePermissions(request.agent.permissions, request.workspaceRoot),
    request.policy,
    mcpServers,
    runToolCommands(runToolsOf(request)),
  );
  args.push('--permission-mode', permissions.permissionMode);
  args.push('--tools', permissions.tools.join(','));
  // Only the MCP servers agent.yaml lists, whatever the policy: without `--strict-mcp-config` the
  // user's own servers and connectors (which `--tools` does not remove) would join the session.
  args.push('--strict-mcp-config');
  // Auto-memory would let the session read and write ~/.claude/projects/<run>/memory/, outside what the
  // permissions allow, and each run's folder is new, so nothing it saves would ever be read again.
  args.push('--settings', JSON.stringify({ autoMemoryEnabled: false }));
  // Variadic flags go last: a positional argument placed after one would be swallowed by it.
  // There is none here (the task goes on stdin), but keeping this order means a future flag
  // inserted above can never accidentally end up after these.
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

/**
 * How long Claude Code lets a command run when the agent may ask (`ask` run tool): 30 minutes, past the script's own
 * wait, so the person has time to answer. Its default is 2 minutes.
 */
const ASK_COMMAND_TIMEOUT_MS = String(30 * 60 * 1000);

/** Claude Code (`claude -p … --output-format stream-json`). */
export class ClaudeAgentProvider extends AgentProvider {
  readonly id: string = 'claude';
  readonly binaries: readonly (readonly [string, ...string[]])[] = [['claude']];
  /** After cursor in `auto`. */
  readonly autoPriority: number = 3;
  readonly credentials = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
  readonly credentialHelp =
    'O provider claude precisa de CLAUDE_CODE_OAUTH_TOKEN (rode `claude setup-token`), ANTHROPIC_API_KEY ou ANTHROPIC_AUTH_TOKEN no .env.';

  buildArgs(request: ProviderRequest): readonly string[] {
    return buildArgs(request);
  }

  /** With the `ask` run tool, a command may run as long as the person takes to answer. */
  override variables({ request }: ProviderVariablesInput): Readonly<Record<string, string>> {
    if (!runToolsOf(request).some((tool) => tool.name === 'ask')) return {};
    return { BASH_DEFAULT_TIMEOUT_MS: ASK_COMMAND_TIMEOUT_MS, BASH_MAX_TIMEOUT_MS: ASK_COMMAND_TIMEOUT_MS };
  }

  /** A message of the person as Claude Code's stream input takes it: one JSON line. */
  override inputMessage(text: string): string {
    return `${JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } })}\n`;
  }

  createParser(): StreamParser {
    return createStreamJsonParser({ planFromExitPlanMode: true });
  }
}
