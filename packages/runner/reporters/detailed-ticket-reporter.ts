import fs from 'node:fs';
import path from 'node:path';

import { readAppliedLocations } from '@choliba/projects';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { formatDuration, isStdoutTty, LiveRegion, printBox, writeStdout } from '@choliba/terminal/output';

const DISPLAY_DELAY_MS = 1_500;

export interface TicketInfo {
  suffix?: string;
  title?: string;
  project?: string;
  environment?: string;
}

function markerFor(status: TestResult['status']): string {
  if (status === 'passed') return '✓';
  if (status === 'skipped') return '○';
  return '✗';
}

function embedInlineScreenshots(result: TestResult): void {
  for (const attachment of result.attachments) {
    if (attachment.body || !attachment.path || !attachment.contentType.startsWith('image/')) continue;
    try {
      attachment.body = fs.readFileSync(attachment.path);
    } catch {
      // missing screenshot is not fatal
    }
  }
}

export default class DetailedTicketReporter implements Reporter {
  private readonly ticketInfo: TicketInfo;
  private readonly projectsRoot: string;
  private readonly liveMode: boolean;
  private readonly liveRegion: LiveRegion;
  private readonly displayTimers = new Map<string, NodeJS.Timeout>();
  private readonly runningTests = new Set<string>();

  constructor(options: TicketInfo = {}) {
    this.ticketInfo = options;
    this.projectsRoot = readAppliedLocations().PROJECTS_DIR;
    this.liveMode = isStdoutTty();
    this.liveRegion = new LiveRegion();
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
    embedInlineScreenshots(result);

    if (result.status === 'skipped') {
      this.liveRegion.remove(test.id);
      if (this.liveMode) this.liveRegion.redraw();
      return;
    }

    const { prefix, location } = this.buildTestLineInfo(test);
    const marker = markerFor(result.status);
    const duration = formatDuration(result.duration);
    const finalLine = `${prefix} ${marker} ${test.title} (${duration})\n${location}\n\n`;

    if (!this.liveMode) {
      writeStdout(finalLine);
      return;
    }

    this.liveRegion.remove(test.id);
    this.liveRegion.printPermanent(finalLine);
  }

  onEnd(): void {
    for (const timer of this.displayTimers.values()) clearTimeout(timer);
    this.displayTimers.clear();
    this.liveRegion.stop();
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
