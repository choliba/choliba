/**
 * Exemplo 1 do curso de events: pedido e cobrança. Todo pedido feito dispara
 * a cobrança, mas `fazerPedido` não sabe que existe cobrança, e `cobrar` não
 * sabe quem fez o pedido: os dois só conhecem o nome do produtor, 'loja'.
 *
 *   bun guides/events/exemplos/1-pedido-e-cobranca.ts
 */
import { createConsumer, createProducer } from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const loja = createProducer('loja');

/** Faz um pedido e avisa que ele foi feito. */
function fazerPedido(cliente: string, valor: number): void {
  writeOut(`pedido de ${cliente}: R$ ${valor.toFixed(2)}\n`);
  loja.emit({ type: 'pedido_feito', cliente, valor });
}

/** Cobra um pedido. */
function cobrar(cliente: string, valor: number): void {
  writeOut(`  cobrança de ${cliente}: R$ ${valor.toFixed(2)}\n`);
}

const cobranca = createConsumer((event) => {
  if (event.type !== 'pedido_feito') return;
  cobrar(String(event['cliente']), Number(event['valor']));
});
cobranca.subscribe('loja');

fazerPedido('Ana', 42.5); // → cobrança de Ana
fazerPedido('Bruno', 18); // → cobrança de Bruno

cobranca.unsubscribeAll();
fazerPedido('Carla', 10); // sem cobrança: ninguém assina mais a loja
