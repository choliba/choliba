/**
 * Exemplo 2 do curso de events: dois produtores e três consumidores, um deles
 * ouvindo os dois; depois, desassinar de um produtor só e de todos.
 *
 *   produtor1 ─┬─▶ consumidor1
 *              └─▶ consumidor2
 *   produtor2 ─┬─▶ consumidor1
 *              └─▶ consumidor3
 *
 *   bun guides/events/exemplos/2-varios.ts
 */
import {
  createConsumer,
  createProducer,
  type CholibaEvent,
} from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

/** A função de um consumidor que mostra o que recebeu, com o próprio nome. */
function imprimir(consumidor: string) {
  return (event: CholibaEvent): void => {
    writeOut(`  ${consumidor} ← ${event.source}: ${event.type}\n`);
  };
}

const produtor1 = createProducer('produtor1');
const produtor2 = createProducer('produtor2');

const consumidor1 = createConsumer(imprimir('consumidor1'));
const consumidor2 = createConsumer(imprimir('consumidor2'));
const consumidor3 = createConsumer(imprimir('consumidor3'));

consumidor1.subscribe('produtor1', 'produtor2'); // escuta dois
consumidor2.subscribe('produtor1');
consumidor3.subscribe('produtor2');

writeOut('dois produtores, três consumidores\n');
produtor1.emit({ type: 'a' }); // consumidor1 e consumidor2
produtor2.emit({ type: 'b' }); // consumidor1 e consumidor3

writeOut('desassinar o consumidor1 do produtor1\n');
consumidor1.unsubscribe('produtor1');
writeOut(`  consumidor1 assina: ${consumidor1.sources().join(', ')}\n`);
produtor1.emit({ type: 'c' }); // só consumidor2
produtor2.emit({ type: 'd' }); // consumidor1 e consumidor3

for (const consumidor of [consumidor1, consumidor2, consumidor3]) {
  consumidor.unsubscribeAll();
}
produtor1.emit({ type: 'e' }); // ninguém ouve
writeOut('depois de unsubscribeAll, ninguém recebe "e"\n');
