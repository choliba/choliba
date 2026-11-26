/**
 * Exemplo 6 do curso de execute: acompanhar várias execuções. O
 * OutputDispatcher guarda uma sequência por execução, e cada um lê só a sua;
 * quem quer ver todas assina um produtor de eventos (src/events), sem saber
 * quem roda o quê.
 */
import { createConsumer, createProducer } from '../../../src/events/index';
import { Executor, OutputDispatcher } from '../../../src/execute/index';
import type { ProgramOutput } from '../../../src/execute/types';
import { writeOut } from '../../../src/output/stdio';

const dispatcher = new OutputDispatcher<ProgramOutput>();
const executor = new Executor();
const executions = createProducer('execucoes');

// O observador: assina o produtor e recebe cada pedaço, com a execução e o programa.
createConsumer((event) => {
  writeOut(
    `  [observador] ${String(event['executionId'])} (${String(event['programId'])}): ${String(event['text'])}\n`,
  );
}).subscribe('execucoes');

/** Roda e publica cada pedaço; quem chamou lê a sequência da sua execução. */
async function run(
  executionId: string,
  programId: string,
  text: string,
): Promise<void> {
  const own = dispatcher.open(executionId, programId);
  void (async () => {
    for await (const output of executor.run({
      executable: 'echo',
      arguments: [text],
    })) {
      dispatcher.publish(executionId, programId, output);
      executions.emit({
        type: 'saida',
        executionId,
        programId,
        text: output.chunk.trim(),
      });
    }
    dispatcher.close(executionId, programId);
  })();
  for await (const { chunk } of own)
    writeOut(`[${executionId}] ${chunk.trim()}\n`);
}

await run('execucao-1', 'eco', 'primeira');
await run('execucao-2', 'eco', 'segunda');
