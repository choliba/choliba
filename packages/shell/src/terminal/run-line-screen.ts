import type { AnsiColor, Theme } from '../theme';
import { formatLine } from './formatter';
import { frameBottom, frameLines, frameTop } from './frame';
import { DEFAULT_COLUMNS, StatusFooter } from './status-footer';
import type { Writable, WritableWithColumns } from './writable';
import { footerLines, providerContext, summaryLine, type RunPresentationInfo } from './run-footer';

export interface LineRunScreen {
  readonly framed: boolean;
  readonly out: Writable;
  readonly err: Writable;
  readonly warn: Writable;
  model(name: string): void;
  onInterrupt(listener: () => void): void;
  onMessage(listener: (text: string) => void): void;
  close(exitCode: number): void;
}

export interface LineRunScreenOptions {
  readonly info: RunPresentationInfo;
  readonly name: string;
  readonly color: AnsiColor | undefined;
  readonly theme: Theme;
  readonly stdout: WritableWithColumns;
  readonly stderr: Writable;
  readonly now: () => Date;
  readonly footer: boolean;
  readonly every: (ms: number, tick: () => void) => () => void;
}

export function createLineRunScreen(options: LineRunScreenOptions): LineRunScreen {
  return options.footer ? footerScreen(options) : plainScreen(options);
}

function plainScreen(options: LineRunScreenOptions): LineRunScreen {
  const prefix = formatLine(
    'provider',
    options.theme.paint('providers', options.info.provider, options.info.provider),
    {
      colorize: options.theme.enabled,
      color: options.theme.colorOf('labels', 'provider'),
    },
  );
  options.stdout.write(`${prefix}${providerContext(options.info)}\n`);
  return {
    framed: false,
    out: options.stdout,
    err: options.stderr,
    warn: options.stderr,
    model: noop,
    onInterrupt: noop,
    onMessage: noop,
    close: noop,
  };
}

function footerScreen(options: LineRunScreenOptions): LineRunScreen {
  const now = (): number => options.now().getTime();
  const width = (): number => terminalWidth(options.stdout);
  let model: string | undefined;
  const current = (): RunPresentationInfo => (model === undefined ? options.info : { ...options.info, model });
  options.stdout.write(
    `\n${frameTop(options.name, width(), (text) => options.theme.paint('agents', options.name, text, options.color))}\n`,
  );
  const footer = new StatusFooter(options.stdout, (columns) => footerLines(current(), now(), columns, options.theme));
  const framed = (stream: Writable): Writable => {
    const above = footer.writer(stream);
    return {
      write: (text) => {
        above.write(`${frameLines(text, width()).join('\n')}\n`);
      },
    };
  };
  const stop = options.every(50, () => {
    footer.draw();
  });
  footer.draw();
  return {
    framed: true,
    out: framed(options.stdout),
    err: framed(options.stderr),
    warn: framed(options.stderr),
    model: (reported) => {
      model = reported;
    },
    onInterrupt: noop,
    onMessage: noop,
    close: (exitCode) => {
      stop();
      footer.close();
      options.stdout.write(`${frameBottom(width())}\n${summaryLine(current(), now(), exitCode)}\n`);
    },
  };
}

function terminalWidth(stdout: WritableWithColumns): number {
  const columns = stdout.columns ?? 0;
  return columns > 0 ? columns : DEFAULT_COLUMNS;
}

function noop(): void {
  // No terminal input to handle.
}
