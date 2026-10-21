export {
  applyLocations,
  CHOL_GLOBAL_DIR,
  CHOL_PROJECTS_DIR,
  CHOL_TICKET_RUNS,
  projectLocations,
  readAppliedLocations,
  LocationsError,
  resolveProjectsDir,
  type ProjectLocations,
} from '@choliba/workspace';
export {
  PROJECTS_SUBDIR,
  PROJECT_CONFIG_FILE,
  PROJECT_ENV_EXAMPLE_FILE,
  PROJECT_ENV_FILE,
  TESTS_SUBDIR,
  TICKETS_SUBDIR,
  TICKET_RUNS_SUBDIR,
} from '@choliba/workspace';
export { projectsConfig } from '@choliba/workspace';
export {
  REPORT_FOLDER,
  TEST_RESULTS_FOLDER,
  resolveResultsRoot,
  resolveResultsTestFolder,
  type ResultsRootSources,
} from './results';
export {
  assertProjectExists,
  configJsonPath,
  envJsonPath,
  listProjectNames,
  listProjectSpecs,
  projectConfigFile,
  projectDir,
  projectEnvExampleFile,
  projectEnvFile,
  projectExists,
  projectHookFile,
  projectOfArgument,
  projectTestsFolder,
  type ProjectHook,
} from './project-paths';
