import type { AgentEvent } from '../../common';

/**
 * The tools that hand work to another agent: `Agent` in Claude Code (once `Task`), `Task` in Cursor
 * (`taskToolCall`). No agent of choliba delegates: Claude's session never has these tools (`--tools`), but
 * Cursor has no permission that removes them, so a call to one stops the run (`delegationOf`).
 */
const SUBAGENT_TOOLS: readonly string[] = ['Agent', 'Task'];

/** The subagent tool `event` calls, or `undefined` when it calls none. */
export function delegationOf(event: AgentEvent): string | undefined {
  if (event.type !== 'tool-call' || !SUBAGENT_TOOLS.includes(event.name)) {
    return undefined;
  }
  return event.name;
}

/** Why the run stopped, naming the tool the agent called. */
export function delegationMessage(tool: string): string {
  return `✗ o agente tentou delegar a um subagente (${tool}); a execução foi interrompida: nenhum agente do choliba delega trabalho.`;
}
