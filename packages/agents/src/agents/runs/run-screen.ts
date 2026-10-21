import {
  DEFAULT_COLUMNS,
  frameBottom,
  frameLines,
  frameTop,
  createLineRunScreen,
  type Panel,
  type PanelOptions,
  type Writable,
  type WritableWithColumns,
  oneLine,
  summaryLine,
} from '@choliba/core';

import type { RunFooterInfo, RunScreen } from '../interfaces/run-footer.interface';
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
  if (!deps.footer || deps.panel === undefined) return lineScreen(info, request, deps);
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
      panel === undefined ? lineScreen(info, request, deps) : panelScreen(panel, current, request, deps),
    );
}

function lineScreen(info: RunFooterInfo, request: RunAgentRequest, deps: RunScreenDeps): RunScreen {
  const line = createLineRunScreen({
    info,
    name: request.providerRequest.agent.name,
    color: request.providerRequest.agent.color,
    theme: request.theme,
    stdout: deps.stdout,
    stderr: deps.stderr,
    now: deps.now,
    footer: deps.footer,
    every: deps.every ?? everySecond,
  });
  return { ...line, answer: unanswered };
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
