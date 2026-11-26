/**
 * Exemplo 4 do curso de events: o que vem junto no evento. Fora de um agente,
 * o `ts`, os dados e o `source`; dentro de um (`runAs`, como tudo o que roda
 * durante um `Agent.run()`), também `agent`, `run` e `agentProvider`. O
 * produtor manda na origem: um `source` nos dados é ignorado.
 *
 *   bun guides/events/exemplos/4-evento.ts
 */
import { runAs } from '../../../src/context/index';
import { createConsumer, createProducer } from '../../../src/events/index';
import { writeOut } from '../../../src/output/stdio';

const curso = createProducer('curso');
const detalhe = createConsumer((event) => {
  writeOut(`${JSON.stringify(event)}\n`);
});
detalhe.subscribe('curso');

curso.emit({ type: 'gravado', path: 'a.md' }); // fora de um agente

runAs(
  { name: 'assistente', provider: { name: 'ollama', model: 'qwen3.5:4b' } },
  () => curso.emit({ type: 'gravado', path: 'b.md' }), // dentro
);

curso.emit({ type: 'gravado', source: 'outro', path: 'c.md' }); // source fica 'curso'

detalhe.unsubscribeAll();
