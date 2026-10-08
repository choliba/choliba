// `choliba agents list` and the block that describes one agent in its `--help`.

import { listAgents } from '../agent-loader';
import { invocationFromAgent } from '../invocation';
import type { ParsedAgentsArgs } from './agents-flags';
import type { AgentDefinition } from '../../common';
import type { AgentInvocation } from '../interfaces/invocation.interface';
import { resolveAgentsDir } from '../agent-dirs';
import type { RunAgentsCliDeps } from './run-context';

const HELP_WIDTH = 80;

/** Greedy word-wrap: never breaks a word, never exceeds `width` unless a single word already does. */
function wrapText(text: string, width: number): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length > width && current !== '') {
      lines.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }
  lines.push(current);
  return lines;
}

/** A YAML-style list: `key:` followed by one `  - item` per entry, or `key: []` when empty. */
function formatYamlList(key: string, items: readonly string[]): string {
  if (items.length === 0) {
    return `${key}: []`;
  }
  return [`${key}:`, ...items.map((item) => `  - ${item}`)].join('\n');
}

/**
 * Agent metadata in the same shape as `--help` (without CLI usage): `agent.yaml` fields plus
 * resolved command policy. The free-text description is wrapped to `HELP_WIDTH`.
 */
export function formatAgentDetail(command: AgentInvocation, agent: AgentDefinition): string {
  return [
    `id: ${agent.id}`,
    `name: ${agent.displayName}`,
    `version: ${agent.version}`,
    ...wrapText(agent.description, HELP_WIDTH),
    formatYamlList('models', agent.supportedModels),
    formatYamlList(
      'skills',
      agent.skills.map((skill) => skill.name),
    ),
    formatYamlList('modes', agent.modes),
    ...(agent.ticketTypes === undefined ? [] : [formatYamlList('ticket_types', agent.ticketTypes)]),
    formatYamlList(
      'mcps',
      agent.mcps.map((mcp) =>
        mcp.tools === undefined ? mcp.name : [`${mcp.name}:`, ...mcp.tools.map((tool) => `    - ${tool}`)].join('\n'),
      ),
    ),
    '',
    `Policy: ${command.policy} | Modo padrão: ${command.defaultMode} | Task obrigatória: ${command.taskRequired ? 'sim' : 'não'} | Projeto obrigatório: ${agent.projectRequired ? 'sim' : 'não'}`,
  ].join('\n');
}

export function runList(kind: Extract<ParsedAgentsArgs, { kind: 'list' }>, deps: RunAgentsCliDeps): number {
  const agentsDir = resolveAgentsDir(kind.agentsDir, deps.config, deps.repoRoot);
  const agents = listAgents(agentsDir);
  if (agents.length === 0) {
    deps.stdout.write(`No agents found in ${agentsDir}\n`);
    return 0;
  }
  const blocks = agents.map((agent) => formatAgentDetail(invocationFromAgent(agent), agent));
  deps.stdout.write(`${blocks.join('\n\n')}\n`);
  return 0;
}
