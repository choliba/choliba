/**
 * Exemplo 5 do curso de events: assinar só durante uma tarefa. O consumidor
 * assina no começo e desassina no `finally`, aconteça o que acontecer: é o
 * que o agente faz a cada conversa.
 *
 *   bun guides/events/exemplos/5-durante-uma-tarefa.ts
 */
import { createConsumer, createProducer } from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const pedidos = createProducer('pedidos');

function tarefaComEventos(): void {
  const observador = createConsumer((event) => {
    writeOut(`observador ← ${event.source}: ${event.type}\n`);
  });
  observador.subscribe('pedidos');
  try {
    pedidos.emit({ type: 'criado', id: 3 });
    pedidos.emit({ type: 'pronto', id: 3 });
  } finally {
    observador.unsubscribeAll();
  }
}

tarefaComEventos();
pedidos.emit({ type: 'criado', id: 4 }); // fora da tarefa: ninguém ouve
writeOut('fora da tarefa, o pedido 4 não foi ouvido\n');
