import { join } from 'node:path';

/** How long the `ask` script waits for an answer before telling the agent to go on without one: 25 minutes. */
export const ASK_TIMEOUT_MS = 25 * 60 * 1000;

/** A question the agent asks through the `ask` run tool, as its script writes it. */
export interface AskQuestion {
  readonly id: string;
  readonly question: string;
  /** The choices, when the agent gave some; none is a question answered in words. */
  readonly options: readonly string[];
  /** Whether more than one of the `options` may be chosen. */
  readonly multi: boolean;
}

/** What the screen answers: the person's answer, or why there is none. */
export type AskAnswer =
  | { readonly status: 'answered'; readonly answer: string | readonly string[] }
  | { readonly status: 'skipped' }
  | { readonly status: 'unavailable' };

/**
 * Where the `ask` script and the screen exchange questions and answers: a folder inside the run folder, which both
 * sandboxes give the provider to write in. The script writes `<id>.question.json`; the screen, `<id>.answer.json`.
 */
export function askExchangeDir(runDir: string): string {
  return join(runDir, '.choliba-ask');
}

/**
 * The `ask` run tool's script, self-contained like `deleteScript`: it writes the question in the exchange folder,
 * waits for the answer and prints it (one choice per line for `--multi`), exit 0. With no answer (the person skipped
 * it, nobody can answer, or the wait ran out), it says so on stderr and exits 2, so the agent goes on with an assumption
 * it states.
 */
export function askScript(exchangeDir: string, timeoutMs: number = ASK_TIMEOUT_MS): string {
  return `#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = ${JSON.stringify(exchangeDir)};
const timeoutMs = ${JSON.stringify(timeoutMs)};
const usage = 'Uso: ask "<pergunta>" [--options a,b,c] [--multi]';

function parse(argv) {
  const words = [];
  let options = [];
  let multi = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--multi') multi = true;
    else if (arg === '--options') {
      options = (argv[index + 1] ?? '').split(',').map((option) => option.trim()).filter((option) => option !== '');
      index += 1;
    } else words.push(arg);
  }
  const question = words.join(' ').trim();
  if (question === '' || (multi && options.length === 0)) {
    console.error(usage);
    process.exit(64);
  }
  return { question, options, multi };
}

function leave(message) {
  console.error(message + ' Siga com uma premissa explícita e registre-a no que entregar.');
  process.exit(2);
}

const asked = parse(process.argv.slice(2));
const id = String(Date.now()) + '-' + String(process.pid);
mkdirSync(dir, { recursive: true });
const pending = join(dir, id + '.question.tmp');
writeFileSync(pending, JSON.stringify({ id, ...asked }));
renameSync(pending, join(dir, id + '.question.json'));

const answerFile = join(dir, id + '.answer.json');
const deadline = Date.now() + timeoutMs;
while (!existsSync(answerFile)) {
  if (Date.now() > deadline) {
    rmSync(join(dir, id + '.question.json'), { force: true });
    leave('Sem resposta em ' + String(Math.round(timeoutMs / 60000)) + ' minutos.');
  }
  await Bun.sleep(250);
}
const reply = JSON.parse(readFileSync(answerFile, 'utf8'));
if (reply.status === 'skipped') leave('A pessoa preferiu não responder.');
if (reply.status !== 'answered') leave('Ninguém pode responder nesta execução (ela não roda num terminal).');
console.log(Array.isArray(reply.answer) ? reply.answer.join('\\n') : reply.answer);
`;
}
