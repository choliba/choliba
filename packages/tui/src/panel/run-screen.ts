import type { Writable, WritableWithColumns } from '@choliba/kernel';
import type { AnsiColor, Panel, PanelQuestion, PanelReply, RunPresentationInfo, Theme } from '@choliba/shell';
import { frameBottom, frameLines, frameTop, summaryLine } from '@choliba/shell';

export interface PanelRunScreen {
  readonly framed: true;
  readonly out: Writable;
  readonly err: Writable;
  /** A notice in the warning color, line by line, in the conversation like the rest. */
  readonly warn: Writable;
  model(name: string): void;
  onInterrupt(listener: () => void): void;
  onMessage(listener: (text: string) => void): void;
  answer(question: PanelQuestion): Promise<PanelReply>;
  close(exitCode: number): void;
}

export interface PanelRunScreenOptions {
  readonly panel: Panel;
  readonly currentInfo: () => RunPresentationInfo;
  readonly reportModel: (name: string) => void;
  readonly name: string;
  readonly color: AnsiColor | undefined;
  readonly theme: Theme;
  readonly stdout: WritableWithColumns;
  readonly now: () => Date;
  readonly every: (ms: number, tick: () => void) => () => void;
  readonly hostedPanel: boolean;
}

export function createPanelRunScreen(options: PanelRunScreenOptions): PanelRunScreen {
  const now = (): number => options.now().getTime();
  const width = (): number => terminalWidth(options.stdout);
  const transcript: string[] = [];
  const shown: Writable = {
    write: (text) => {
      transcript.push(text);
      options.panel.write(text);
    },
  };
  // What withdraws the run's questions from the field when it ends.
  const asking = new AbortController();
  const stop = options.every(50, () => {
    options.panel.refresh();
  });
  return {
    framed: true,
    out: shown,
    err: shown,
    warn: {
      write: (text) => {
        shown.write(text.replace(/[^\n]+/g, (line) => `\u001b[33m${line}\u001b[39m`));
      },
    },
    model: (name) => {
      options.reportModel(name);
    },
    onInterrupt: (listener) => {
      options.panel.onInterrupt(listener);
    },
    onMessage: (listener) => {
      options.panel.onMessage(listener);
    },
    answer: async (question) => {
      shown.write(`? ${question.question}\n`);
      const reply = await options.panel.ask(question, asking.signal);
      shown.write(`→ ${reply.status === 'skipped' ? '(sem resposta)' : [reply.answer].flat().join(', ')}\n`);
      return reply;
    },
    close: (exitCode) => {
      // A question of the run still in the field has no one to answer it any more.
      asking.abort();
      stop();
      options.panel.close();
      if (options.hostedPanel) return;
      const top = frameTop(options.name, width(), (text) =>
        options.theme.paint('agents', options.name, text, options.color),
      );
      const lines = frameLines(transcript.join(''), width());
      options.stdout.write(
        `\n${[top, ...lines, frameBottom(width())].join('\n')}\n${summaryLine(options.currentInfo(), now(), exitCode)}\n`,
      );
    },
  };
}

function terminalWidth(stdout: WritableWithColumns): number {
  const columns = stdout.columns ?? 0;
  return columns > 0 ? columns : 120;
}
