import type { AgentEvent } from '../../common';

/** The built-in tool `event` calls among `tools`, which the provider's permissions cannot limit; `undefined` otherwise. */
export function unenforcedToolOf(event: AgentEvent, tools: readonly string[]): string | undefined {
  if (event.type !== 'tool-call' || !tools.includes(event.name)) {
    return undefined;
  }
  return event.name;
}

/** Why the run stopped, naming the tool the agent called. */
export function unenforcedToolMessage(tool: string): string {
  return `✗ o agente usou ${tool}, que as permissões deste provider não conseguem limitar; a execução foi interrompida.`;
}
