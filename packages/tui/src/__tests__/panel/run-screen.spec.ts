import type { Panel, RunPresentationInfo, Theme } from '@choliba/shell';
import type { WritableWithColumns } from '@choliba/kernel';
import { createPanelRunScreen } from '../../panel/run-screen';

describe('createPanelRunScreen', () => {
  it('writes to the panel and prints its transcript and summary when it closes', () => {
    const written: string[] = [];
    const output: string[] = [];
    const panel = createPanel({ written });
    let tick: (() => void) | undefined;
    let stopped = false;
    const stdout: WritableWithColumns = { columns: 60, write: (text) => output.push(text) };
    const info: RunPresentationInfo = {
      provider: 'claude',
      place: { kind: 'local' },
      startedAt: 0,
    };
    let model: string | undefined;
    const screen = createPanelRunScreen({
      panel,
      currentInfo: () => (model === undefined ? info : { ...info, model }),
      reportModel: (reported) => {
        model = reported;
      },
      name: 'worker',
      color: undefined,
      theme: theme(),
      stdout,
      now: () => new Date(1000),
      every: (_ms, callback) => {
        tick = callback;
        return () => {
          stopped = true;
        };
      },
      hostedPanel: false,
    });

    screen.out.write('hello\n');
    screen.model('model');
    screen.close(0);
    tick?.();

    expect(screen.framed).toBe(true);
    expect(written).toEqual(['hello\n']);
    expect(output.join('')).toContain('claude · model · local · decorrido 00:00:01.000 · código 0');
    expect(stopped).toBe(true);
    expect(panel.closed).toBe(true);
    expect(panel.refreshed).toBe(true);
  });

  it('takes its question out of the field when it closes, the answer skipped', async () => {
    const written: string[] = [];
    const signals: (AbortSignal | undefined)[] = [];
    const panel: Panel = {
      ...createPanel({ written }),
      ask: (_question, signal) =>
        new Promise((reply) => {
          signals.push(signal);
          signal?.addEventListener('abort', () => {
            reply({ status: 'skipped' });
          });
        }),
    };
    const screen = createPanelRunScreen({
      panel,
      currentInfo: () => ({ provider: 'claude', place: { kind: 'local' }, startedAt: 0 }),
      reportModel: () => undefined,
      name: 'worker',
      color: undefined,
      theme: theme(),
      stdout: { write: () => undefined },
      now: () => new Date(0),
      every: () => () => undefined,
      hostedPanel: true,
    });

    const answer = screen.answer({ question: 'Qual o nome?', options: [], multi: false });
    screen.close(1);

    expect(await answer).toEqual({ status: 'skipped' });
    expect(signals[0]?.aborted).toBe(true);
    expect(written).toEqual(['? Qual o nome?\n', '→ (sem resposta)\n']);
  });

  it('does not print a hosted panel transcript on close', () => {
    const output: string[] = [];
    const screen = createPanelRunScreen({
      panel: createPanel({ written: [] }),
      currentInfo: () => ({ provider: 'claude', place: { kind: 'local' }, startedAt: 0 }),
      reportModel: () => undefined,
      name: 'worker',
      color: undefined,
      theme: theme(),
      stdout: { write: (text) => output.push(text) },
      now: () => new Date(0),
      every: () => () => undefined,
      hostedPanel: true,
    });

    screen.close(0);

    expect(output).toEqual([]);
  });
});

function createPanel(state: { readonly written: string[] }) {
  return {
    closed: false,
    refreshed: false,
    write(text: string) {
      state.written.push(text);
    },
    refresh() {
      this.refreshed = true;
    },
    onInterrupt: () => undefined,
    onMessage: () => undefined,
    ask: () => Promise.resolve({ status: 'skipped' as const }),
    close() {
      this.closed = true;
    },
  } satisfies Panel & { closed: boolean; refreshed: boolean };
}

function theme(): Theme {
  return {
    enabled: false,
    paint: (_role, _name, text) => text,
    colorOf: () => 'blue',
  };
}
