/**
 * Exemplo 2 do curso de network: ouvir as decisões do gate. O gate é o
 * produtor `network`, e um consumidor recebe cada decisão (o destino, a
 * decisão, quem decidiu e o motivo) aqui no host, venha a conexão de qualquer
 * sandbox. Sem sandbox nem rede: o gate decide três destinos, e só.
 *
 *   bun guides/network/exemplos/2-decisoes.ts
 */
import { createConsumer } from '../../../src/events/index';
import { NETWORK_SOURCE, NetworkGate } from '../../../src/network/index';
import { writeOut } from '../../../src/output/stdio';

const gate = new NetworkGate({
  rules: {
    default: 'deny',
    allow: [{ operations: ['connect'], hosts: ['example.com'] }],
    deny: [{ operations: ['*'], hosts: ['169.254.169.254'] }],
  },
  // Ninguém aprova nada neste exemplo.
  approve: () => Promise.resolve('deny'),
});

const decisions = createConsumer((event) => {
  if (event.type !== 'decision') return;
  writeOut(
    `${String(event['hostname'])}:${String(event['port'])} → ${String(event['decision'])} (${String(event['decidedBy'])})\n` +
      `   ${String(event['reason'])}\n`,
  );
});
decisions.subscribe(NETWORK_SOURCE);

try {
  for (const hostname of [
    'example.com',
    'www.wikipedia.org',
    '169.254.169.254',
  ]) {
    await gate.decide({ hostname, port: 443, protocol: 'https' });
  }
} finally {
  decisions.unsubscribeAll();
}
