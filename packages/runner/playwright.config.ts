import fs from 'node:fs';
import path from 'node:path';

import { applyLocations, resolveLocations } from '@choliba/projects';
import * as projects from '@choliba/projects';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

import type { PlaywrightProjectConfig } from './shared/env';
import { getTargetProject } from './shared/project-scope';

const packageRoot = import.meta.dirname;
// The workspace comes from the runner CLI (`CHOLIBA_WORKSPACE`); run by hand inside this repository,
// it is the repository root. Built, this file is `.js` next to `reporters/` and `shared/` in `.js` too.
const monorepoRoot = process.env['CHOLIBA_WORKSPACE'] ?? path.join(packageRoot, '..', '..');
const EXT = import.meta.url.endsWith('.ts') ? '.ts' : '.js';

const playwrightEnv = resolveLocations(monorepoRoot, process.env);
applyLocations(playwrightEnv);

const projectsDir = playwrightEnv.CHOL_PROJECTS_DIR;
if (!fs.existsSync(projectsDir)) {
  throw new Error(`CHOL_PROJECTS_DIR="${projectsDir}" não existe.`);
}

// Found from the command line in the main process; the workers, which load this file again with other
// arguments, get it from the environment the main process leaves for them.
const targetProject = process.env['CHOLIBA_PROJECT'] ?? getTargetProject(projectsDir);
if (targetProject) process.env['CHOLIBA_PROJECT'] = targetProject;
let resultsRoot: string | undefined;
let targetProjectConfig: PlaywrightProjectConfig | undefined;
// The active environment's URL: a spec just calls `page.goto('…')`, relative to it.
let baseURL: string | undefined;
// How the active environment starts its application (`envs[].start`): Playwright runs it in `appDir` when `baseURL`
// does not answer, waits for it, and stops it at the end; one already up (started by the person) is reused.
let webServer: PlaywrightTestConfig['webServer'];

if (targetProject) {
  // Fails, naming the file and the field, unless the project is complete and configured (no CHANGE_ME).
  const settings = projects.loadProjectSettings(projectsDir, targetProject);
  // A spec reads its project's credentials (.env.json, active environment, then _global), BASE_URL and
  // APP_DIR from process.env. The workers load this file too, so they get them as well; the project's
  // values win over the shell's (USERNAME, for one, is usually set there).
  Object.assign(process.env, settings.env);
  targetProjectConfig = settings.config;
  baseURL = settings.environment.baseURL;
  const { start } = settings.environment;
  if (start !== undefined) {
    webServer = {
      command: start,
      cwd: settings.appDir,
      url: baseURL,
      reuseExistingServer: true,
      timeout: 180_000,
      // The server's log goes into the run's output, where whoever ran the tests sees why it did not start.
      stdout: 'pipe',
      stderr: 'pipe',
    };
  }
  resultsRoot = projects.resolveResultsRoot({
    runsFolder: projects.resolveTicketRunsFolder(projects.resolveTicketRunsRoot(playwrightEnv), targetProject),
    environmentResultsDir: settings.environment.resultsDir,
    globalResultsDir: settings.globals['resultsDir'],
  });
}

const ticket = targetProject ? process.env['QA_TICKET'] : undefined;

// The tests of criteria a later ticket replaces (`substitui`) stay out of the run, except when that very ticket
// runs on its own (`choliba tests <projeto>:<ticket>` warns about it). Playwright matches `<device> <file> <title>`.
const retiredPatterns = targetProject
  ? projects.retiredTestPatterns(
      targetProject,
      projects
        .retiredCriteria(projectsDir, targetProject)
        .filter((item) => process.env['QA_BATCH'] !== undefined || item.ticket !== ticket),
    )
  : [];
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
  ...(webServer ? { webServer } : {}),
  ...(retiredPatterns.length > 0 ? { grepInvert: [...retiredPatterns] } : {}),
  reporter: [
    ticket ? [path.join(packageRoot, 'reporters', `detailed-ticket-reporter${EXT}`), ticketInfo] : ['list'],
    ['html', { outputFolder: reportFolderResolved, open: 'never' }],
    ['json', { outputFile: path.join(reportFolderResolved, 'results.json') }],
  ],
  globalSetup: path.join(packageRoot, 'shared', `global-setup${EXT}`),
  globalTeardown: path.join(packageRoot, 'shared', `global-teardown${EXT}`),
  use: {
    ...(baseURL ? { baseURL } : {}),
    // Kept for each failed test, so the agents (skill playwright-trace) can read what happened.
    trace: 'retain-on-failure',
    screenshot: 'on',
  },
  projects: ENABLED_DEVICES.map((name) => ({
    name,
    use: { ...DEVICE_PRESETS[name] },
  })),
});
