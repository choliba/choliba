import {
  DEFAULT_COLUMNS,
  frameBottom,
  frameLines,
  frameTop,
  StatusFooter,
  type Panel,
  type PanelOptions,
  type Theme,
  type Writable,
  type WritableWithColumns,
} from '@choliba/core';

import type { RunFooterInfo, RunScreen } from '../interfaces/run-footer.interface';
import { footerLines, oneLine, providerContext, summaryLine } from './run-footer';
import { formatProviderLine } from './event-render';
import { everySecond, type RunAgentRequest } from './run-agent';

export const FOOTER_REFRESH_MS = 50;

export interface RunScreenDeps {
  readonly stdout: WritableWithColumns;
  readonly stderr: Writable;
  readonly now: () => Date;
  readonly every?: (ms: number, tick: () => void) => () => void;
  readonly footer: boolean;
  readonly panel?: (options: PanelOptions) => Promise<Panel | undefined>;
  readonly hostedPanel: boolean;
}

interface ReportedInfo {
  info(): RunFooterInfo;
  report(model: string): void;
}

export function createRunScreen(
  info: RunFooterInfo,
  request: RunAgentRequest,
  deps: RunScreenDeps,
): RunScreen | Promise<RunScreen> {
  if (!deps.footer) return plainScreen(info, request.theme, deps);
  if (deps.panel === undefined) return footerScreen(info, request, deps);
  const { name, color } = request.providerRequest.agent;
  const now = (): number => deps.now().getTime();
  const current = reportedInfo(info);
  return deps
    .panel({
      title: name,
      titleColor: request.theme.colorOf('agents', name, color),
      footer: (columns) => [oneLine(current.info(), now(), Math.floor(columns / 2))],
      hint:
        request.provider.adapter.inputMessage === undefined
          ? 'Aqui você responde quando o agente perguntar'
          : 'Enter envia · Ctrl+J cria uma linha',
    })
    .then((panel) =>
      panel === undefined ? footerScreen(info, request, deps) : panelScreen(panel, current, request, deps),
    );
}

function plainScreen(info: RunFooterInfo, theme: Theme, deps: RunScreenDeps): RunScreen {
  deps.stdout.write(`${formatProviderLine(info.provider, theme)}${providerContext(info)}\n`);
  return {
    framed: false,
    out: deps.stdout,
    err: deps.stderr,
    model: noop,
    onInterrupt: noop,
    onMessage: noop,
    answer: unanswered,
    close: noop,
  };
}

function footerScreen(info: RunFooterInfo, request: RunAgentRequest, deps: RunScreenDeps): RunScreen {
  const { theme } = request;
  const { name, color } = request.providerRequest.agent;
  const now = (): number => deps.now().getTime();
  const width = (): number => screenWidth(deps.stdout);
  let model: string | undefined;
  const current = (): RunFooterInfo => (model === undefined ? info : { ...info, model });
  deps.stdout.write(`\n${frameTop(name, width(), (text) => theme.paint('agents', name, text, color))}\n`);
  const footer = new StatusFooter(deps.stdout, (columns) => footerLines(current(), now(), columns, theme));
  const framed = (stream: Writable): Writable => {
    const above = footer.writer(stream);
    return {
      write: (text) => {
        above.write(`${frameLines(text, width()).join('\n')}\n`);
      },
    };
  };
  const stop = (deps.every ?? everySecond)(FOOTER_REFRESH_MS, () => {
    footer.draw();
  });
  footer.draw();
  return {
    framed: true,
    out: framed(deps.stdout),
    err: framed(deps.stderr),
    model: (reported) => {
      model = reported;
    },
    onInterrupt: noop,
    onMessage: noop,
    answer: unanswered,
    close: (exitCode) => {
      stop();
      footer.close();
      deps.stdout.write(`${frameBottom(width())}\n${summaryLine(current(), now(), exitCode)}\n`);
    },
  };
}

function panelScreen(panel: Panel, current: ReportedInfo, request: RunAgentRequest, deps: RunScreenDeps): RunScreen {
  const { theme } = request;
  const { name, color } = request.providerRequest.agent;
  const now = (): number => deps.now().getTime();
  const width = (): number => screenWidth(deps.stdout);
  const transcript: string[] = [];
  const shown: Writable = {
    write: (text) => {
      transcript.push(text);
      panel.write(text);
    },
  };
  const stop = (deps.every ?? everySecond)(FOOTER_REFRESH_MS, () => {
    panel.refresh();
  });
  return {
    framed: true,
    out: shown,
    err: shown,
    model: (reported) => {
      current.report(reported);
    },
    onInterrupt: (listener) => {
      panel.onInterrupt(listener);
    },
    onMessage: (listener) => {
      panel.onMessage(listener);
    },
    answer: async (question) => {
      shown.write(`? ${question.question}\n`);
      const reply = await panel.ask(question);
      shown.write(`→ ${reply.status === 'skipped' ? '(sem resposta)' : [reply.answer].flat().join(', ')}\n`);
      return reply;
    },
    close: (exitCode) => {
      stop();
      panel.close();
      if (deps.hostedPanel) return;
      const top = frameTop(name, width(), (text) => theme.paint('agents', name, text, color));
      const lines = frameLines(transcript.join(''), width());
      deps.stdout.write(
        `\n${[top, ...lines, frameBottom(width())].join('\n')}\n${summaryLine(current.info(), now(), exitCode)}\n`,
      );
    },
  };
}

function reportedInfo(info: RunFooterInfo): ReportedInfo {
  let model: string | undefined;
  return {
    info: () => (model === undefined ? info : { ...info, model }),
    report: (reported) => {
      model = reported;
    },
  };
}

export function screenWidth(stdout: WritableWithColumns): number {
  const columns = stdout.columns ?? 0;
  return columns > 0 ? columns : DEFAULT_COLUMNS;
}

function unanswered(): Promise<{ status: 'unavailable' }> {
  return Promise.resolve({ status: 'unavailable' });
}

function noop(): void {
  // Nothing to restore.
}
