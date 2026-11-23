/**
 * Exemplo 4 do curso de network: uma política de rede completa (allow,
 * requireApproval com ignores, deny) e o que ela decide para cada destino,
 * sem sandbox nem modelo. `networkRulesOf` tira da política só a parte de
 * rede, a mesma que o workspace entrega ao gate; `decideByRules` é a decisão
 * das regras; `localPorts` diz o que vira túnel até o host.
 *
 *   bun guides/network/exemplos/4-politica-completa.ts
 */

import {
  decideByRules,
  localPorts,
  networkRulesOf,
} from '../../../src/network/index';
import { writeOut } from '../../../src/output/stdio';
import type { AgentPolicy } from '../../../src/policy/index';

const policy: AgentPolicy = {
  default: 'deny',
  allow: {
    network: [
      {
        operations: ['connect'],
        hosts: [
          'github.com',
          '*.github.com',
          'registry.npmjs.org',
          'localhost:3000',
          'localhost:5173',
        ],
        ignores: { hosts: ['gist.github.com'] },
      },
    ],
  },
  requireApproval: {
    network: [
      {
        operations: ['connect'],
        hosts: ['*'],
        ignores: {
          hosts: [
            'www.google.com.br',
            '*.google.com',
            'localhost',
            'localhost:*',
          ],
        },
      },
    ],
  },
  deny: {
    network: [
      {
        operations: ['*'],
        hosts: ['169.254.169.254', 'metadata.google.internal'],
      },
    ],
  },
};

const rules = networkRulesOf(policy);

for (const destination of [
  'registry.npmjs.org:443',
  'api.github.com:443',
  'github.com:22',
  'gist.github.com:443',
  'exemplo.com:443',
  '169.254.169.254:80',
  'localhost:5173',
]) {
  const { policy: decision, source } = decideByRules(rules, destination);
  writeOut(`${destination.padEnd(24)} ${decision.padEnd(17)} (${source})\n`);
}

writeOut(`\nTúneis até o host: ${localPorts(rules).join(', ')}\n`);
