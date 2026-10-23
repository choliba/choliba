import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { isValidAgentName, loadAgent } from './agent-loader';
import type { AgentInvocation } from './interfaces/invocation.interface';
import { invocationFromAgent } from './invocation';

/**
 * Resolves a CLI name to a command. An explicit entry in `builtins` wins; otherwise, if `name`
 * is an agent in `agentsDir`, a command is synthesized from its `agent.yaml`. Returns `undefined`
 * when there is no such agent, so the caller can print a clear "unknown command". An agent that
 * exists but does not load (an invalid agent.yaml) throws its `AgentConfigError`: the
 * reason, naming the file, is what the user needs, not "unknown command".
 */
export function resolveInvocation(
  name: string,
  builtins: readonly AgentInvocation[],
  agentsDir: string,
): AgentInvocation | undefined {
  const explicit = builtins.find((c) => c.name === name);
  if (explicit) {
    return explicit;
  }

  if (!isValidAgentName(name)) {
    return undefined;
  }
  if (!existsSync(join(agentsDir, name))) {
    return undefined;
  }
  return invocationFromAgent(loadAgent(agentsDir, name));
}
