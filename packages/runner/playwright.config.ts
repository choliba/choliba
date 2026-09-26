import fs from 'node:fs';
import path from 'node:path';

import { applyLocations, resolveLocations } from '@choliba/projects';
import * as projects from '@choliba/projects';
import { defineConfig, devices } from '@playwright/test';

import type { PlaywrightProjectConfig } from './shared/env';
import { getTargetProject } from './shared/project-scope';

const packageRoot = import.meta.dirname;
const monorepoRoot = path.join(packageRoot, '..', '..');

const playwrightEnv = resolveLocations(monorepoRoot, process.env);
applyLocations(playwrightEnv);

const projectsDir = playwrightEnv.PROJECTS_DIR;
if (!fs.existsSync(projectsDir)) {
  throw new Error(`PROJECTS_DIR="${projectsDir}" não existe.`);
}

const targetProject = getTargetProject(projectsDir);
let resultsRoot: string | undefined;
let targetProjectConfig: PlaywrightProjectConfig | undefined;

if (targetProject) {
  // Fails, naming the file and the field, unless the project is complete and configured (no CHANGE_ME).
  const settings = projects.loadProjectSettings(projectsDir, targetProject);
  targetProjectConfig = settings.config;
  resultsRoot = projects.resolveResultsRoot({
    globalDir: playwrightEnv.GLOBAL_DIR,
    project: targetProject,
    environmentResultsDir: settings.environment.resultsDir,
    globalResultsDir: settings.globals['resultsDir'],
  });
}

const ticket = targetProject ? process.env['QA_TICKET'] : undefined;
const ticketRunsRoot = targetProject ? projects.resolveTicketRunsRoot(playwrightEnv) : undefined;

let outputDir: string | undefined;
let reportFolder: string | undefined;

if (ticket && targetProject) {
  const runsRoot = ticketRunsRoot ?? projectsDir;
  outputDir = projects.resolveTestResultsFolder(runsRoot, targetProject, ticket);
  reportFolder = projects.resolveReportFolder(runsRoot, targetProject, ticket);
} else {
  outputDir = resultsRoot === undefined ? undefined : projects.resolveResultsTestFolder(resultsRoot);
  reportFolder =
    ticketRunsRoot && targetProject ? projects.resolveReportFolder(ticketRunsRoot, targetProject) : undefined;
}

const reportFolderResolved = reportFolder ?? projects.REPORT_FOLDER;

const DEVICE_NAMES = ['chromium', 'firefox', 'webkit', 'mobile-chrome'] as const;

let ticketInfo: { suffix: string; title?: string; project: string; environment?: string } | undefined;
let ticketJson:
  | {
      titulo?: string;
      ambiente?: string;
      devices?: Record<string, boolean>;
      criterios?: { devices?: Record<string, boolean> }[];
    }
  | undefined;

if (ticket && targetProject) {
  const suffix = projects.ticketSuffix(targetProject, ticket);
  const ticketJsonPath = projects.ticketJsonPath(projectsDir, targetProject, ticket);
  ticketInfo = { suffix, project: targetProject };
  if (fs.existsSync(ticketJsonPath)) {
    ticketJson = projects.readJsonFile(ticketJsonPath) as typeof ticketJson;
    ticketInfo = {
      suffix,
      project: targetProject,
      ...(ticketJson?.titulo ? { title: ticketJson.titulo } : {}),
      ...(ticketJson?.ambiente ? { environment: ticketJson.ambiente } : {}),
    };
  }
}

function isDeviceEnabled(name: string): boolean {
  if (!targetProject) return true;
  if (targetProjectConfig?.devices?.[name] !== false) return true;
  if (ticketJson?.devices?.[name] === true) return true;
  return ticketJson?.criterios?.some((c) => c.devices?.[name] === true) ?? false;
}

const ENABLED_DEVICES = DEVICE_NAMES.filter(isDeviceEnabled);

const DEVICE_PRESETS: Record<
  (typeof DEVICE_NAMES)[number],
  (typeof devices)[string] & { firefoxUserPrefs?: Record<string, unknown> }
> = {
  chromium: devices['Desktop Chrome'],
  firefox: { ...devices['Desktop Firefox'], firefoxUserPrefs: { 'network.http.http3.enable': false } },
  webkit: devices['Desktop Safari'],
  'mobile-chrome': devices['Pixel 7'],
};

export default defineConfig({
  testDir: projectsDir,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : 4,
  ...(outputDir ? { outputDir } : {}),
  reporter: [
    ticket ? [path.join(packageRoot, 'reporters', 'detailed-ticket-reporter.ts'), ticketInfo] : ['list'],
    ['html', { outputFolder: reportFolderResolved, open: 'never' }],
    ['json', { outputFile: path.join(reportFolderResolved, 'results.json') }],
  ],
  globalSetup: path.join(packageRoot, 'shared', 'globalSetup.ts'),
  globalTeardown: path.join(packageRoot, 'shared', 'globalTeardown.ts'),
  use: {
    trace: 'on-first-retry',
    screenshot: 'on',
  },
  projects: ENABLED_DEVICES.map((name) => ({
    name,
    use: { ...DEVICE_PRESETS[name] },
  })),
});
