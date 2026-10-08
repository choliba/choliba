import path from 'node:path';

import { loadRepoConfig, resolveTheme, type Theme } from '@choliba/core';
import { readAppliedLocations } from '@choliba/projects';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { formatDuration, isStdoutTty, LiveRegion, printBox, writeStdout } from '@choliba/terminal/output';

import { WORKSPACE_ENV } from '../src/tests/playwright-env';

const DISPLAY_DELAY_MS = 1_500;

export interface TicketInfo {
  suffix?: string;
  title?: string;
  project?: string;
  environment?: string;
}

function markerFor(status: TestResult['status'], theme: Theme): string {
  if (status === 'passed') return theme.paint('states', 'success', '✓');
  if (status === 'skipped') return theme.paint('states', 'hint', '○');
  return theme.paint('states', 'error', '✗');
}

/**
 * The workspace's colors (`CHOL_COLORS`), read here because the reporter runs in Playwright's process, outside
 * choliba's: `choliba tests` passes the workspace (and `FORCE_COLOR=0` when color is off) in the environment.
 */
function workspaceTheme(env: NodeJS.ProcessEnv = process.env): Theme {
  const root = env[WORKSPACE_ENV];
  const config = root === undefined ? env : loadRepoConfig(root, env);
  return resolveTheme(config, { env, isTTY: isStdoutTty(), noColorFlag: false });
}

export default class DetailedTicketReporter implements Reporter {
  private readonly ticketInfo: TicketInfo;
  private readonly projectsRoot: string;
  private readonly liveMode: boolean;
  private readonly liveRegion: LiveRegion;
  private readonly displayTimers = new Map<string, NodeJS.Timeout>();
  private readonly runningTests = new Set<string>();
  private readonly theme: Theme;

  constructor(options: TicketInfo = {}) {
    this.ticketInfo = options;
    this.projectsRoot = readAppliedLocations().CHOL_PROJECTS_DIR;
    this.liveMode = isStdoutTty();
    this.liveRegion = new LiveRegion();
    this.theme = workspaceTheme();
  }

  onBegin(_config: FullConfig): void {
    const { suffix, title, project, environment } = this.ticketInfo;
    if (!suffix) return;

    const lines = [
      `Projeto: ${project ?? '?'}`,
      `Ambiente: ${environment ?? '?'}`,
      `Ticket: ${suffix}${title ? ` - ${title}` : ''}`,
    ];
    const colsEnv = Number(process.env['TERM_COLS']);
    printBox(lines, colsEnv > 0 ? { cols: colsEnv } : undefined);
    writeStdout('\n');
  }

  onTestBegin(test: TestCase): void {
    if (!this.liveMode) return;

    const startedAt = Date.now();
    const { prefix, location } = this.buildTestLineInfo(test);
    this.runningTests.add(test.id);

    const timer = setTimeout(() => {
      if (!this.runningTests.has(test.id)) return;
      this.liveRegion.set({ id: test.id, text: `${prefix} ${test.title}\n${location}`, since: startedAt });
    }, DISPLAY_DELAY_MS);
    timer.unref();
    this.displayTimers.set(test.id, timer);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.clearDisplayTimer(test.id);
    this.runningTests.delete(test.id);

    if (result.status === 'skipped') {
      this.liveRegion.remove(test.id);
      if (this.liveMode) this.liveRegion.redraw();
      return;
    }

    const { prefix, location } = this.buildTestLineInfo(test);
    const marker = markerFor(result.status, this.theme);
    const duration = formatDuration(result.duration);
    const finalLine = `${prefix} ${marker} ${test.title} (${duration})\n${location}\n\n`;

    if (!this.liveMode) {
      writeStdout(finalLine);
      return;
    }

    this.liveRegion.remove(test.id);
    this.liveRegion.printPermanent(finalLine);
  }

  /**
   * Output outside any test: the application's server (`envs[].start`), which Playwright hands over with each
   * line prefixed `[WebServer]`. Shown, so whoever runs the tests sees why the application did not start.
   */
  onStdOut(chunk: string | Buffer, test?: TestCase): void {
    this.printOutsideTests(chunk, test);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase): void {
    this.printOutsideTests(chunk, test);
  }

  onEnd(): void {
    for (const timer of this.displayTimers.values()) clearTimeout(timer);
    this.displayTimers.clear();
    this.liveRegion.stop();
  }

  private printOutsideTests(chunk: string | Buffer, test: TestCase | undefined): void {
    if (test !== undefined) return;
    const text = chunk.toString();
    if (this.liveMode) {
      this.liveRegion.printPermanent(text);
      return;
    }
    writeStdout(text);
  }

  private clearDisplayTimer(testId: string): void {
    const timer = this.displayTimers.get(testId);
    if (timer) {
      clearTimeout(timer);
      this.displayTimers.delete(testId);
    }
  }

  private buildTestLineInfo(test: TestCase): { prefix: string; location: string } {
    const device = test.parent.project()?.name ?? '?';
    const { line, column, file } = test.location;
    return {
      prefix: `[${device}]`,
      location: `${this.toRelativePath(file)}:${String(line)}:${String(column)}`,
    };
  }

  private toRelativePath(file: string): string {
    if (this.projectsRoot && file.startsWith(this.projectsRoot)) {
      return path.relative(this.projectsRoot, file);
    }
    return file;
  }
}
