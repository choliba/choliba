export { selectEnvironment, type ProjectSettings } from '@choliba/domain';
export { formatRetired, fullTicket, retiredTestPatterns, ticketSuffix, type RetiredCriterion } from '@choliba/domain';
export { readJsonFile } from './json-file';
export {
  APP_PREPARED_ENV,
  AppError,
  prepareApp,
  type PrepareAppContext,
  type SetupSpawn,
  type SetupStdio,
} from './project-app-prepare';
export { ensureApp, type EnsureAppDeps, type RunningApp } from './project-app-ensure';
export { holdApp, shareApp } from './project-app-share';
export { answers, launchApp, type LaunchedApp } from './project-app-launch';
export {
  assertProjectExists,
  configJsonPath,
  envJsonPath,
  listProjectNames,
  loadProjectSettings,
  projectDir,
  projectExists,
  projectHookFile,
  projectOfArgument,
  projectTestsFolder,
  type ProjectHook,
} from './project-files';
export {
  REPORT_FOLDER,
  TEST_RESULTS_FOLDER,
  canonicalizeSuffix,
  fullyRetiredTickets,
  listTicketSuffixes,
  resolveReportFolder,
  resolveResultsRoot,
  resolveResultsTestFolder,
  resolveTicketRunsFolder,
  resolveTicketRunsRoot,
  resolveTicketSpecFiles,
  resolveTestResultsFolder,
  retiredCriteria,
  ticketFilePath,
  ticketJsonPath,
  ticketSpecFiles,
  ticketsFolderPath,
  type ResultsRootSources,
  type TicketJson,
} from './ticket-files';
