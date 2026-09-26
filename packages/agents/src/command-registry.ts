import { isValidAgentName, loadAgent } from './agent-loader';
import type { CommandDefinition } from './command.types';
import { commandFromAgent } from './define-command';

/**
 * Resolves a CLI name to a command. An explicit entry in `builtins` wins; otherwise, if `name`
 * is a loadable agent in `agentsDir`, a command is synthesized from its `agent.yaml`. Returns
 * `undefined` when neither applies, so the caller can print a clear "unknown command" instead
 * of a stack trace.
 */
export async function resolveCommand(
  name: string,
  builtins: readonly CommandDefinition[],
  agentsDir: string,
): Promise<CommandDefinition | undefined> {
  const explicit = builtins.find((c) => c.name === name);
  if (explicit) {
    return explicit;
  }

  if (!isValidAgentName(name)) {
    return undefined;
  }
  try {
    return commandFromAgent(await loadAgent(agentsDir, name));
  } catch {
    return undefined;
  }
}
