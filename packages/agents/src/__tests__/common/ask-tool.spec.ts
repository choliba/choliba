import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ProviderRequest } from '../../common/interfaces/provider.interface';
import { NO_PERMISSIONS, readAgentPermissions } from '../../common/agent-permissions';
import { askExchangeDir, askScript, type AskAnswer } from '../../common/run-tools/ask-tool';
import { activeRunTools, applyRunTools, planRunTools, runToolLines } from '../../common/run-tools/run-tools';
import { claudeOllamaProvider, claudeProvider } from '../helpers/providers';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';
import { makeTmpDir } from '../helpers/tmp';

interface Asked {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly question: unknown;
}

/** Runs the `ask` script with `args`, answers the question it writes with `answer` (none: never answers). */
async function ask(args: readonly string[], answer?: AskAnswer, timeoutMs = 5000): Promise<Asked> {
  const tmp = makeTmpDir('ask-tool');
  try {
    const exchange = askExchangeDir(tmp.path);
    const script = `${tmp.path}.ask`;
    const restore = applyRunTools([{ path: script, content: askScript(exchange, timeoutMs) }]);
    const child = spawn(script, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    let question: unknown;
    const answering = setInterval(() => {
      const file = existsSync(exchange)
        ? readdirSync(exchange).find((name) => name.endsWith('.question.json'))
        : undefined;
      if (file === undefined || question !== undefined) return;
      question = JSON.parse(readFileSync(join(exchange, file), 'utf8'));
      if (answer !== undefined) {
        writeFileSync(join(exchange, file.replace('.question.json', '.answer.json')), JSON.stringify(answer));
      }
    }, 50);
    const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
    clearInterval(answering);
    restore();
    return { code, stdout, stderr, question };
  } finally {
    tmp.cleanup();
  }
}

describe('the ask script', () => {
  it('writes the question with its choices and prints the answer', async () => {
    const run = await ask(['Qual', 'framework?', '--options', 'React, Vue'], { status: 'answered', answer: 'Vue' });

    expect(run.question).toMatchObject({ question: 'Qual framework?', options: ['React', 'Vue'], multi: false });
    expect(run).toMatchObject({ code: 0, stdout: 'Vue\n' });
  });

  it('prints each choice of a multiple answer on a line of its own', async () => {
    const run = await ask(['Quais?', '--options', 'a,b,c', '--multi'], { status: 'answered', answer: ['a', 'c'] });

    expect(run).toMatchObject({ code: 0, stdout: 'a\nc\n' });
  });

  it('exits 2, telling the agent to go on with an assumption, when there is no answer', async () => {
    const skipped = await ask(['Pergunta?'], { status: 'skipped' });
    expect(skipped.code).toBe(2);
    expect(skipped.stderr).toContain('A pessoa preferiu não responder. Siga com uma premissa explícita');

    const unavailable = await ask(['Pergunta?'], { status: 'unavailable' });
    expect(unavailable.code).toBe(2);
    expect(unavailable.stderr).toContain('Ninguém pode responder nesta execução');

    const late = await ask(['Pergunta?'], undefined, 300);
    expect(late.code).toBe(2);
    expect(late.stderr).toContain('Sem resposta em 0 minutos.');
  });

  it('refuses no question, and --multi without choices', async () => {
    expect((await ask([])).code).toBe(64);
    expect((await ask(['Quais?', '--multi'])).stderr).toContain('Uso: ask');
  });
});

function request(declared: unknown, model?: string): ProviderRequest {
  return {
    agent: {
      name: 'po',
      id: 'po',
      displayName: 'PO',
      version: '1.0.0',
      description: 'd',
      supportedModels: [],
      skills: [],
      mcps: [],
      policy: 'read-only',
      taskRequired: true,
      projectRequired: false,
      allowWithoutTicket: false,
      defaultMode: 'execute',
      modes: ['execute'],
      permissions: declared === undefined ? NO_PERMISSIONS : readAgentPermissions(declared),
      steps: NO_MODE_STEPS,
      sections: fakeSections('ask'),
      dir: '/w/agents/po',
      sourcePath: '/w/agents/po/agent.yaml',
    },
    mode: 'execute',
    policy: 'read-only',
    userPrompt: 'x',
    workspaceRoot: '/w',
    runDir: '/w/.cache/runs/x',
    addDirs: [],
    model,
  };
}

function askingRequest(): ProviderRequest {
  return request({ allow: { tools: { ask: ['*'] } } }, 'ollama:qwen3.5:4b');
}

describe('the ask run tool', () => {
  const RUN_DIR = '/w/.cache/runs/x';

  it('is on when allow.tools names it, and the prompt says how and when to use it', () => {
    const permissions = readAgentPermissions({ allow: { tools: { ask: ['*'] } } });

    expect(activeRunTools(permissions, RUN_DIR, 'read-only')).toEqual([
      { name: 'ask', path: `${RUN_DIR}.ask`, allowed: undefined, denied: [] },
    ]);
    const line = runToolLines(permissions, { runDir: RUN_DIR, root: '/w', policy: 'read-only' }).join('\n');
    expect(line).toContain(`${RUN_DIR}.ask "<question>" [--options a,b,c] [--multi]`);
    expect(line).toContain('Exit 2 means no answer');
    expect(askExchangeDir(RUN_DIR)).toBe(`${RUN_DIR}/.choliba-ask`);
  });

  it('writes a script that exchanges in the run folder and waits 25 minutes', () => {
    const [file] = planRunTools(askingRequest(), {});

    expect(file?.path).toBe('/w/.cache/runs/x.ask');
    expect(file?.content).toContain('const dir = "/w/.cache/runs/x/.choliba-ask";');
    expect(file?.content).toContain('const timeoutMs = 1500000;');
  });
});

describe('the Claude providers with the ask run tool', () => {
  const reachable = (url: string): string => url;

  it('let a command run 30 minutes when the agent may ask, and keep the default otherwise', () => {
    const asking = askingRequest();
    const timeouts = { BASH_DEFAULT_TIMEOUT_MS: '1800000', BASH_MAX_TIMEOUT_MS: '1800000' };

    expect(claudeProvider.variables({ request: asking, config: {}, reachable })).toEqual(timeouts);
    expect(claudeProvider.variables({ request: request(undefined), config: {}, reachable })).toEqual({});
    expect(claudeOllamaProvider.variables({ request: asking, config: {}, reachable })).toMatchObject({
      ...timeouts,
      ANTHROPIC_AUTH_TOKEN: 'ollama',
    });
  });
});
