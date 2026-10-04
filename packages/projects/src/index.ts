export { ProjectsError } from './errors';
export {
  applyLocations,
  readAppliedLocations,
  LocationsError,
  resolveLocations,
  resolveProjectsDir,
  type ProjectLocations,
} from './locations';
export { readJsonFile } from './json-file';
export {
  loadProjectSettings,
  PLACEHOLDER_VALUE,
  selectEnvironment,
  type ProjectEnvironment,
  type ProjectSettings,
  type ProjectSettingsConfig,
} from './settings';
export {
  REPORT_FOLDER,
  TEST_RESULTS_FOLDER,
  resolveResultsRoot,
  resolveResultsTestFolder,
  type ResultsRootSources,
} from './results';
export {
  projectDir,
  projectConfigFile,
  projectEnvFile,
  projectEnvExampleFile,
  projectTestsFolder,
  projectHookFile,
  type ProjectHook,
  assertProjectExists,
  configJsonPath,
  envJsonPath,
  projectExists,
  listProjects,
  listProjectNames,
  readProjectConfig,
  createProject,
  type ProjectInfo,
  type ProjectConfig,
  type CreateProjectOptions,
  type CreatedProject,
} from './project';
export {
  ticketSuffix,
  fullTicket,
  parseTarget,
  ticketsFolderPath,
  ticketFilePath,
  listTicketSuffixes,
  resolveTicketsFolder,
  listTickets,
  listTicketKeys,
  canonicalizeSuffix,
  canonicalTicket,
  ticketJsonPath,
  resolveTicketRunsRoot,
  resolveTicketRunsFolder,
  resolveReportFolder,
  resolveTestResultsFolder,
  ticketSpecFiles,
  resolveTicketSpecFiles,
  type TicketJson,
} from './ticket';
export {
  projectTemplatesDir,
  ticketTemplatesDir,
  listTicketTypes,
  readTicketTemplate,
  describeTicketTypes,
  nextTicketSuffix,
  planTicket,
  createTicket,
  ticketPlaceholders,
  type NewTicket,
  type NewTicketOptions,
  type TicketTemplate,
} from './ticket-template';
export { criteriaProblems, ticketCriteriaProblems } from './ticket-criteria';
export { findReadme, readText, readmeSummary } from './readme';
export { runProjectsCli, type ProjectsCliDeps } from './cli';
