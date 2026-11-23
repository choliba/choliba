import {
  Agent,
  ensureDirectory,
  humanApprover,
  join,
  OllamaProvider,
  runScript,
  AGENT_SHORTCUTS,
  agentConversation,
  TuiAdapter,
  UsageError,
  Workspace,
  type OllamaCli,
  type AgentPolicy,
} from '../../../src/index';
import {
  currentDirectory,
  programArguments,
} from '../../../src/execute/process';

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

/**
 * The local Ollama agent on a full screen (the TUI): the messages on top,
 * the status line and what you type at the bottom. Only the CLI changes:
 *
 *   bun guides/agent/exemplos/7-tui.ts claude
 *   bun guides/agent/exemplos/7-tui.ts codex
 *
 * /help lists the TUI's commands; Ctrl+A opens the approvals; Ctrl+C ends it.
 */
const MODEL = 'llama3.2:latest';

/** Which CLI: the first argument. */
function chosenCli(): OllamaCli {
  const cli = programArguments().at(0);
  if (cli === 'claude' || cli === 'codex') return cli;
  throw new UsageError(
    `CLI desconhecida: ${cli ?? '(nenhuma)'}. Use: bun guides/agent/exemplos/7-tui.ts claude|codex`,
  );
}

await runScript(async ({ signal }) => {
  const cli = chosenCli();
  const root = join(
    currentDirectory(),
    'storage',
    'workspaces',
    `agente-tui-${cli}`,
  );
  ensureDirectory(root);
  const tui = agentConversation(new TuiAdapter({ shortcuts: AGENT_SHORTCUTS }));

  await new Agent({
    resume: false,
    name: `agente-tui-${cli}`,
    prompt: 'Diga oi em uma linha e pergunte em que pode ajudar.',
    provider: new OllamaProvider({ cli, model: MODEL }),
    workspace: new Workspace({ type: 'bubblewrap', root }),
    policy: politica,
    interaction: tui,
    approve: humanApprover(tui, signal),
    signal,
    conversation: true,
  }).run();
});
