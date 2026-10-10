import type { Writable } from '@choliba/core';

import { loadAgent } from './agent-loader';

/**
 * Reads one agent's `agent.yaml` (via `loadAgent`, which validates it for real — see
 * `agent-validation.ts` — and requires `name` to be a valid, loadable agent under `agentsDir`;
 * empty, unknown or invalid agents throw `AgentConfigError` there) and writes it as JSON: the
 * identity first, then its skills and MCP servers, where it is, and its text (`sections`). For
 * tooling that inspects an agent's definition without invoking it.
 */
export function printAgentDefinition(agentsDir: string, name: string, stdout: Writable): void {
  const agent = loadAgent(agentsDir, name);
  const json = {
    id: agent.id,
    name: agent.name,
    displayName: agent.displayName,
    version: agent.version,
    description: agent.description,
    supportedModels: agent.supportedModels,
    skills: agent.skills,
    mcps: agent.mcps,
    dir: agent.dir,
    sourcePath: agent.sourcePath,
    sections: agent.sections,
  };
  stdout.write(`${JSON.stringify(json, null, 2)}\n`);
}
