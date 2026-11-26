/**
 * Seção "AgentPolicy em uma página" do curso de policy: uma política completa,
 * lida em voz alta, e as respostas dela a algumas ações.
 *
 *   bun guides/policy/exemplos/0-uma-pagina.ts
 */
import { writeOut } from '../../../src/output/stdio';
import {
  PolicyEngine,
  type AgentAction,
  type AgentPolicy,
} from '../../../src/policy/index';

const policy: AgentPolicy = {
  // O que nenhuma regra cobre: aqui, nega.
  default: 'deny',

  // Liberado sem perguntar.
  allow: {
    filesystem: [
      {
        operations: ['read', 'write'],
        paths: ['/workspace/**'],
        ignores: { paths: ['/workspace/.env'] },
      },
    ],
    execution: [{ commands: ['bun *', 'git status', 'git diff *'] }],
    network: [
      {
        operations: ['connect'],
        hosts: ['registry.npmjs.org', '*.github.com'],
      },
    ],
    secrets: [{ operations: ['read'], secrets: ['NODE_ENV'] }],
  },

  // Pergunta antes.
  requireApproval: {
    execution: [{ commands: ['git commit *', 'rm *'] }],
  },

  // Nunca, nem com aprovação.
  deny: {
    execution: [{ commands: ['sudo *', 'rm -rf *'] }],
    network: [{ operations: ['*'], hosts: ['169.254.169.254'] }],
  },
};

const questions: readonly (readonly [string, AgentAction])[] = [
  ['rodar bun test', { category: 'execution', command: 'bun test' }],
  ['rodar rm build.log', { category: 'execution', command: 'rm build.log' }],
  ['rodar rm -rf dist', { category: 'execution', command: 'rm -rf dist' }],
  ['rodar curl x.com', { category: 'execution', command: 'curl x.com' }],
  [
    'ler NODE_ENV',
    { category: 'secrets', operation: 'read', secret: 'NODE_ENV' },
  ],
  [
    'ler GITHUB_TOKEN',
    { category: 'secrets', operation: 'read', secret: 'GITHUB_TOKEN' },
  ],
  [
    'conectar em api.github.com',
    { category: 'network', operation: 'connect', host: 'api.github.com' },
  ],
];

const engine = new PolicyEngine(policy);
for (const [question, action] of questions) {
  const { policy: decision, source } = engine.check(action);
  writeOut(`${question.padEnd(28)} ${decision} (${source})\n`);
}
