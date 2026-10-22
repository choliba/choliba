/** Why the run stopped, naming the built-in tool the agent called, which the provider's permissions cannot limit. */
export function unenforcedToolMessage(tool: string): string {
  return `✗ o agente usou ${tool}, que as permissões deste provider não conseguem limitar; a execução foi interrompida.`;
}
