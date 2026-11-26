/**
 * Exemplo 5 do curso de network: o gate sozinho, sem sandbox nem rede, para
 * ver a ordem das decisões. Cada linha diz o que o gate respondeu e quem
 * decidiu (o `decidedBy` do evento). Sem ledger, as aprovações valem só para
 * este gate, e nada é gravado.
 *
 *   bun guides/network/exemplos/5-gate.ts
 */
import { createConsumer } from '../../../src/events/index';
import {
  decideByRules,
  NETWORK_SOURCE,
  NetworkGate,
  type NetworkRules,
} from '../../../src/network/index';
import { writeOut } from '../../../src/output/stdio';

const rules: NetworkRules = {
  default: 'deny',
  allow: [{ operations: ['connect'], hosts: ['registry.npmjs.org'] }],
  requireApproval: [{ operations: ['connect'], hosts: ['*.example.com'] }],
};

const gate = new NetworkGate({
  rules,
  // Num agente, os endereços do provider: aqui, a API do modelo.
  alwaysAllow: ['api.anthropic.com:443'],
  // Quem aprova responde "nesta sessão" a tudo que perguntam.
  approve: () => Promise.resolve('session'),
});

let decidedBy = '';
const decisions = createConsumer((event) => {
  if (event.type === 'decision') decidedBy = String(event['decidedBy']);
});
decisions.subscribe(NETWORK_SOURCE);

try {
  for (const hostname of [
    'api.anthropic.com',
    'registry.npmjs.org',
    'a.example.com',
    'a.example.com',
    'outro.com',
  ]) {
    const { decision } = await gate.decide({
      hostname,
      port: 443,
      protocol: 'https',
    });
    writeOut(`${hostname.padEnd(20)} ${decision.padEnd(5)} (${decidedBy})\n`);
  }
} finally {
  decisions.unsubscribeAll();
}

writeOut('\nSó as regras, sem o gate:\n');
for (const destination of ['registry.npmjs.org:443', 'outro.com:443']) {
  const { policy, source } = decideByRules(rules, destination);
  writeOut(`${destination.padEnd(22)} ${policy.padEnd(5)} (${source})\n`);
}
