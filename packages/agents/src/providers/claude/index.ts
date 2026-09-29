import { mcpServersMap } from '../../mcps';
import { assertArgvFits, wrapInstructions } from '../../prompt';
import { createStreamJsonParser } from '../stream-json';
import type { ProviderAdapter, ProviderRequest } from '../provider.types';
import { claudePermissionArgs } from './permissions';

function buildArgs(request: ProviderRequest): readonly string[] {
  const args: string[] = [
    '-p',
    request.userPrompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--append-system-prompt',
    wrapInstructions(request.agent, request.skillsInstruction),
  ];
  if (request.model !== undefined) {
    args.push('--model', request.model);
  }
  const mcpServers = request.mcpServers ?? [];
  const permissions = claudePermissionArgs(request.agent.permissions, request.policy, mcpServers);
  args.push('--permission-mode', permissions.permissionMode);
  if (request.policy === 'read-only' && permissions.tools !== undefined) {
    args.push('--tools', permissions.tools.join(','));
  }
  // Only the MCP servers agent.yaml lists, whatever the policy: without `--strict-mcp-config` the
  // user's own servers and connectors (which `--tools` does not remove) would join the session.
  args.push('--strict-mcp-config');
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

export const claudeProvider: ProviderAdapter = {
  id: 'claude',
  binaries: [['claude']],
  buildArgs,
  createParser: () => createStreamJsonParser({ planFromExitPlanMode: true }),
};
