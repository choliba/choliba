/**
 * Exemplo 3 do curso de network: num agente, a rede é só a política. Com
 * `policy`, o workspace monta a fronteira sozinho (`applyPermissions`): as
 * regras de rede saem de `networkRulesOf(policy)`, e os endereços do provider
 * (aqui, o Ollama) passam sempre. Precisa do Ollama rodando com o modelo do
 * arquivo e da CLI do Claude Code instalada.
 *
 *   bun guides/network/exemplos/3-agente.ts
 */
import { randomUUID } from 'node:crypto';

import {
  Agent,
  ensureDirectory,
  join,
  OllamaProvider,
  runScript,
  Workspace,
} from '../../../src/index';
import { environment } from '../../../src/execute/process';
import { cholibaCacheDir, removePath } from '../../../src/filesystem/index';

const root = join(
  cholibaCacheDir(environment()),
  'network-exemplo',
  randomUUID(),
);
ensureDirectory(root);

await runScript(async () => {
  try {
    await new Agent({
      name: 'assistente',
      prompt:
        'Consulte https://registry.npmjs.org/left-pad e diga a versão mais recente.',
      provider: new OllamaProvider({ cli: 'claude', model: 'qwen3.5:4b' }),
      workspace: new Workspace({ type: 'bubblewrap', root }), // ou docker
      policy: {
        default: 'deny',
        allow: {
          filesystem: [
            { operations: ['read', 'write'], paths: ['/workspace/**'] },
          ],
          network: [{ operations: ['connect'], hosts: ['registry.npmjs.org'] }],
        },
      },
      conversation: false,
    }).run();
  } finally {
    removePath(root);
  }
});
