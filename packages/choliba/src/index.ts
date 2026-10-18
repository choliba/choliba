// The package root: the shell and the `choliba` facade for scripts, with no effect on import. `main.ts` is the bin and
// the only file that runs the shell; the facade reads the process's folder and environment only when a script uses it.
export { choliba, CHOLIBA_SHELL, cholibaShell, createCholibaShell, openCholiba } from './app-shell';
export type {
  Choliba,
  CholibaAgents,
  CholibaConfig,
  CholibaOptions,
  CholibaProject,
  CholibaProjects,
  CholibaSkills,
  CholibaTests,
  CholibaTickets,
} from './library';
export type { ProjectSettings, ProjectSummary, TicketCriterion, TicketInfo } from '@choliba/projects';
export type { AgentDefinition, SkillSummary } from '@choliba/agents';
export type { ConfigGroup, ConfigSetting } from '@choliba/config';
export type { Runtime } from './runtime';
