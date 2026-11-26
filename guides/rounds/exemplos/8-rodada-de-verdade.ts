/**
 * Exemplo 8 do curso de rounds: uma rodada de verdade. Um agente num modelo
 * local do Ollama, pela CLI do Claude Code, parte da fixture `site-vazio`,
 * lê o ticket e troca o título do index.html. Os critérios conferem o título
 * novo e que o ticket não mudou, e a rubrica dá as notas. Precisa do Ollama
 * rodando com o modelo do arquivo e da CLI claude instalada.
 */
import { randomUUID } from 'node:crypto';

import { environment } from '../../../src/execute/process';
import {
  cholibaCacheDir,
  ensureDirectory,
  join,
  readText,
  removePath,
  resolve,
} from '../../../src/filesystem/index';
import { OllamaProvider, type AgentPolicy } from '../../../src/index';
import { writeOut } from '../../../src/output/stdio';
import {
  defineRound,
  noQuestions,
  runRound,
  scoreRound,
  validateRound,
} from '../../../src/rounds/index';
import { runScript } from '../../../src/usage';

/** O modelo: troque por um que o seu Ollama tenha (`ollama list`). */
const MODEL = 'qwen3.5:4b-64k';
/**
 * A janela do modelo, em tokens: a CLI resume a conversa perto dela, e com a
 * janela padrão (32 mil) ela resumiria antes de o agente começar.
 */
const CONTEXT_WINDOW = 65_536;

/**
 * Lê e escreve só na pasta da rodada, e roda só comandos de leitura. O resto
 * é negado: numa rodada, ninguém responde a um pedido de aprovação.
 */
const politica: AgentPolicy = {
  default: 'deny',
  allow: {
    filesystem: [{ operations: ['read', 'write'], paths: ['/workspace/**'] }],
    execution: [{ commands: ['ls', 'ls *', 'cat *', 'pwd'] }],
  },
};

const project = resolve(import.meta.dir, '../../..');
/** As fixtures do curso: a site-vazio fica ao lado dos exemplos. */
const fixtures = join(project, 'guides', 'rounds', 'fixtures');
const scratch = join(
  cholibaCacheDir(environment()),
  'rounds-exemplo',
  randomUUID(),
);
const roundsDir = join(scratch, 'rodadas');
const records = join(scratch, 'registros');
ensureDirectory(roundsDir);
ensureDirectory(records);

const id = 'titulo-goiaba';

await runScript(async () => {
  try {
    const [file = ''] = await runRound(
      defineRound({
        id,
        goal: 'Um modelo local cumpre um ticket pequeno no index.html?',
        start: { fixture: 'site-vazio' },
        actors: {
          dev: {
            provider: new OllamaProvider({
              cli: 'claude',
              model: MODEL,
              contextWindow: CONTEXT_WINDOW,
            }),
            workspace: { type: 'bubblewrap', root: join(roundsDir, id) },
            policy: politica,
          },
        },
        flow: [
          {
            actor: 'dev',
            prompt: () => [
              'Leia o ticket.txt e faça no index.html a alteração que ele pede.',
              'Use as ferramentas de arquivo da CLI para editar.',
            ],
          },
        ],
        criteria: {
          dev: [
            // "faça no index.html a alteração que ele pede": o título novo.
            {
              file: {
                name: 'index.html',
                changed: true,
                matches: [/<h1>[^<]*Goiaba<\/h1>/],
              },
            },
            // O ticket só é lido.
            { file: { name: 'ticket.txt', changed: false } },
            // Um modelo pequeno, nesta máquina: até 10 minutos.
            { limit: { time: '10min' } },
          ],
        },
        rules: [noQuestions()],
      }),
      { dir: records, project, roundsDir, fixtures },
    );

    const record = validateRound(JSON.parse(readText(file)));
    const changed = record.steps.flatMap((step) => step.changed);
    const dev = scoreRound(record, []).actors['dev'];
    const lines = [
      '',
      `alterou: ${changed.join(', ') || 'nada'}`,
      `nota ${String(dev.final)} · eficácia ${String(dev.effectiveness.score)} · eficiência ${String(dev.efficiency.score)}`,
    ];
    for (const criterion of [
      ...dev.effectiveness.criteria,
      ...dev.efficiency.criteria,
    ]) {
      lines.push(
        `  ${criterion.label}: ${criterion.score === null ? '—' : String(criterion.score)} (${criterion.detail})`,
      );
    }
    writeOut(`${lines.join('\n')}\n`);
  } finally {
    removePath(scratch);
  }
});
