/**
 * Exemplo 3 do curso de events: um consumidor de tudo. `ALL_SOURCES` assina
 * todos os produtores, inclusive os que ainda não existem: um painel de
 * depuração, por exemplo.
 *
 *   bun guides/events/exemplos/3-tudo.ts
 */
import {
  ALL_SOURCES,
  createConsumer,
  createProducer,
} from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const painel = createConsumer((event) => {
  writeOut(`painel ← ${event.source}: ${event.type}\n`);
});
painel.subscribe(ALL_SOURCES);

// Dois produtores criados depois da assinatura: o painel recebe os dois.
createProducer('curso').emit({ type: 'gravado', path: 'guides/x/README.md' });
createProducer('rede').emit({ type: 'negado', host: 'exemplo.com:443' });

painel.unsubscribeAll();
