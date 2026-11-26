/**
 * Exemplo 6 do curso de network: quem aprova. A rede usa o mesmo `approve`
 * dos comandos, para a pessoa ter uma fila só: num agente, cada pedido de
 * rede chega a ele como o "comando" `host:porta`, com `category: 'network'`.
 * Este approver nega toda a rede e libera cada comando uma vez; o gate o
 * consulta como o agente faz (`networkOptions`, em src/agent/enforce.ts).
 *
 *   bun guides/network/exemplos/6-quem-aprova.ts
 */
import type { CommandApprover } from '../../../src/approval/gate';
import { NetworkGate } from '../../../src/network/index';
import { writeOut } from '../../../src/output/stdio';

/** Nega a rede; libera cada comando uma vez. */
const approver: CommandApprover = ({ category }) =>
  Promise.resolve(category === 'network' ? 'deny' : 'once');

const gate = new NetworkGate({
  rules: {
    default: 'deny',
    requireApproval: [{ operations: ['connect'], hosts: ['*'] }],
  },
  // Como o agente liga o approver à rede: o destino vira o comando.
  approve: (request) =>
    approver({
      command: `${request.hostname}:${String(request.port)}`,
      pattern: request.pattern,
      reason: request.reason,
      provider: 'exemplo',
      category: 'network',
    }),
});

const network = await gate.decide({
  hostname: 'exemplo.com',
  port: 443,
  protocol: 'https',
});
writeOut(`rede, exemplo.com:443 → ${network.decision}\n`);

const command = await approver({
  command: 'bun test',
  pattern: 'bun test',
  reason: 'A ação corresponde a policy.requireApproval.execution.',
  provider: 'exemplo',
});
writeOut(`comando, bun test → ${command}\n`);
