import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  AgentConfigError,
  agentNeedsProject,
  isValidAgentName,
  parseAgentYaml as parseDomainAgentYaml,
  type AgentDefinition,
  type AgentYamlFields,
} from '@choliba/domain';
import { AGENT_FILE } from '@choliba/workspace';

import { checkStep } from './steps/step-actions';

export { AgentConfigError, isValidAgentName, policyFromPermissions } from '@choliba/domain';

const TICKET_VAR = /\$\{(?:TICKET|TICKET_FILE)\}/;

export function parseAgentYaml(text: string, source: string, folder: string): AgentYamlFields {
  return parseDomainAgentYaml(text, source, folder, checkStep);
}

export function loadAgent(agentsDir: string, name: string): AgentDefinition {
  if (!isValidAgentName(name)) {
    throw new AgentConfigError(`invalid agent name "${name}" (expected lowercase, digits, "-", "_")`);
  }
  const dir = join(agentsDir, name);
  const sourcePath = join(dir, AGENT_FILE);
  let yamlText: string;
  try {
    yamlText = readFileSync(sourcePath, 'utf8');
  } catch {
    throw new AgentConfigError(`agent "${name}" not found: ${sourcePath} does not exist`);
  }
  const fields = parseAgentYaml(yamlText, sourcePath, name);
  if (fields.ticketTypes === undefined && TICKET_VAR.test(yamlText)) {
    throw new AgentConfigError(
      `agent "${name}" usa \${TICKET} ou \${TICKET_FILE}, mas não declara ticket_types: é por eles que o CLI ` +
        `resolve o ticket da execução (${sourcePath})`,
    );
  }
  return { name, dir, sourcePath, ...fields, projectRequired: agentNeedsProject(yamlText, fields) };
}

export function listAgents(agentsDir: string): readonly AgentDefinition[] {
  let entries: readonly string[];
  try {
    entries = readdirSync(agentsDir);
  } catch {
    return [];
  }
  const agents: AgentDefinition[] = [];
  for (const entry of entries.toSorted()) {
    if (entry.startsWith('_') || !isValidAgentName(entry)) {
      continue;
    }
    const dir = join(agentsDir, entry);
    if (!statSync(dir).isDirectory()) {
      continue;
    }
    try {
      agents.push(loadAgent(agentsDir, entry));
    } catch {
      continue;
    }
  }
  return agents;
}
