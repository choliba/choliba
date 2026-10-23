// The package root: the shell and the `choliba` facade for scripts, with no effect on import. `main.ts` is the bin and
// the only file that runs the shell; the facade reads the process's folder and environment only when a script uses it.
export {
  agents,
  choliba,
  CHOLIBA_SHELL,
  cholibaShell,
  config,
  createCholibaShell,
  openCholiba,
  projects,
  providers,
  skills,
  workspace,
} from './app-shell';
export type {
  Choliba,
  CholibaAgents,
  CholibaConfig,
  CholibaMcp,
  CholibaOptions,
  CholibaProject,
  CholibaProjectCounts,
  CholibaProjects,
  CholibaProvider,
  CholibaProviders,
  CholibaSkills,
  CholibaTests,
  CholibaTickets,
  CholibaWorkspace,
} from './library';
export type { ProjectSettings, ProjectStack, ProjectStackItem, RetiredCriterion } from '@choliba/domain';
export type { ProjectSummary } from '@choliba/tui';
export type { TicketCriterion, TicketInfo } from '@choliba/workspace';
export type { AgentDefinition, SkillSummary } from './agents';
export type { CriterionStatus, TestResult, TicketResults } from '@choliba/runner';
export type { ConfigGroup, ConfigSetting } from '@choliba/config';
export type { Runtime } from './runtime';
