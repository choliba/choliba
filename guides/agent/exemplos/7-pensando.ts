/**
 * Exemplo 7 do curso do agente: um `subscribe` que mostra o "pensando" do
 * modelo (os eventos `thinking`: início, a cada segundo e fim). Precisa do
 * Ollama rodando com o modelo do arquivo e da CLI do Codex instalada.
 *
 *   bun guides/agent/exemplos/7-pensando.ts
 */
import {
  getConfig,
  Agent,
  type AgentOutput,
  ensureDirectory,
  OllamaProvider,
  stdioOutput,
  Workspace,
  type AgentPolicy,
} from '../../../src/index';

/**
 * The policy: reads and writes only in the workspace, every command asks
 * first, and anything else (the network included) is denied.
 */
const politica: AgentPolicy = {
  default: 'deny',
  allow: {
    filesystem: [{ operations: ['read', 'write'], paths: ['/workspace/**'] }],
  },
  requireApproval: { execution: [{ commands: ['*'] }] },
};

const root = getConfig().workspaces.dir;
ensureDirectory(root);
const agenteCholiba = new Agent({
  name: 'dev',
  prompt: 'vamos conversar',
  provider: new OllamaProvider({ cli: 'codex', model: 'qwen3.5:4b' }),
  policy: politica,
  subscribe: [listener],
  workspace: new Workspace({ type: 'bubblewrap', root }),
});

await agenteCholiba.run();

/** Only observes: the "thinking" events, on stdio. */
export function listener(output: AgentOutput): void {
  if (output.type() !== 'thinking') return;
  const { phase, seconds } = output.data();
  if (phase === 'start') void stdioOutput.write('pensando…');
  if (phase === 'tick') void stdioOutput.write(`pensando… ${String(seconds)}s`);
  if (phase === 'end') void stdioOutput.write(`pensou ${String(seconds)}s`);
}
