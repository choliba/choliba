import type { LogFile } from '@choliba/shell';

import { loggedPanel } from '../../session/panel-log';
import { fakeChatPanel } from '../../testing';

/** A log that keeps its lines in memory: `[source] text`. */
function memoryLog(): LogFile & { readonly lines: string[] } {
  const lines: string[] = [];
  return {
    path: '',
    lines,
    write: (source, text) => {
      lines.push(`[${source}] ${text}`);
    },
  };
}

describe('loggedPanel', () => {
  it('logs what is said, answered and written, each agent under its name, and passes it on', () => {
    const fake = fakeChatPanel();
    const log = memoryLog();
    const panel = loggedPanel(fake.panel, log);

    panel.say('faça');
    panel.answer('Sandbox \u001b[1mdocker\u001b[22m selecionado.');
    panel.write('→ Bash: bun test', { name: 'test-writer', color: 'red' });
    panel.write('log em x.log');
    panel.clear();
    panel.close();

    expect(log.lines).toEqual([
      '[voce] faça',
      '[choliba] Sandbox \u001b[1mdocker\u001b[22m selecionado.',
      '[test-writer] → Bash: bun test',
      '[choliba] log em x.log',
      '[choliba] conversa limpa',
      '[choliba] painel fechado',
    ]);
    expect(fake.said).toEqual([]);
    expect(fake.voices).toEqual([]);
    expect(fake.closed()).toBe(true);
  });

  it('logs each choice and each question with its answer', async () => {
    const fake = fakeChatPanel();
    const log = memoryLog();
    const panel = loggedPanel(fake.panel, log);
    const request = {
      title: 'Escolha o sandbox',
      description: '',
      options: [{ label: 'local', detail: '', current: true }],
    };

    fake.answerNext(0, undefined);
    expect(await panel.choose(request)).toBe(0);
    expect(await panel.choose(request)).toBeUndefined();
    expect(await panel.ask({ question: 'Qual?', options: [], multi: false })).toEqual({ status: 'skipped' });
    const answered = loggedPanel(
      { ...fake.panel, ask: () => Promise.resolve({ status: 'answered', answer: ['a', 'b'] }) },
      log,
    );
    await answered.ask({ question: 'Quais?', options: ['a', 'b'], multi: true });
    const one = loggedPanel({ ...fake.panel, ask: () => Promise.resolve({ status: 'answered', answer: 'a' }) }, log);
    await one.ask({ question: 'Uma?', options: ['a'], multi: false });

    expect(log.lines).toEqual([
      '[escolha] Escolha o sandbox: local',
      '[escolha] Escolha o sandbox: cancelada',
      '[pergunta] Qual?',
      '[resposta] pulada',
      '[pergunta] Quais?',
      '[resposta] a, b',
      '[pergunta] Uma?',
      '[resposta] a',
    ]);
  });

  it('logs the commands sent or clicked, what has no / being logged where it is said', () => {
    const fake = fakeChatPanel();
    const log = memoryLog();
    const panel = loggedPanel(fake.panel, log);
    const sent: string[] = [];
    panel.onMessage((text) => sent.push(text));
    const picked: number[] = [];
    panel.suggest(
      ['  /agents  Escolhe', '\u001b[1m❯ /projects\u001b[22m  Escolhe'],
      (index) => picked.push(index),
      'Enter',
    );

    fake.send('/sandbox');
    fake.send('olá');
    fake.click(1);
    panel.suggest([]);
    fake.click(0);
    expect(fake.hints).toEqual(['Enter', undefined]);
    // A row past the list names no command.
    panel.suggest(['  /agents'], (index) => picked.push(index));
    fake.click(3);

    expect(sent).toEqual(['/sandbox', 'olá']);
    expect(picked).toEqual([1, 3]);
    expect(log.lines).toEqual(['[comando] /sandbox', '[comando] /projects', '[comando] ']);
  });
});
