import * as domain from '@choliba/domain';
import * as engine from '@choliba/engine';

import * as agentPermissions from '../../common/agent-permissions';
import * as agentProvider from '../../common/agent-provider';
import * as prompt from '../../common/prompt';
import * as providerRegistry from '../../common/provider-registry';
import * as runProject from '../../common/run-project';
import * as runToolPath from '../../common/run-tools/run-tool-path';
import * as runTools from '../../common/run-tools/run-tools';
import * as agentSkills from '../../agents/agent-skills';
import * as definedConfig from '../../agents/defined-config';
import * as invocation from '../../agents/invocation';
import * as runChoice from '../../agents/runs/run-choice';
import * as runPreparation from '../../agents/runs/run-preparation';
import * as ticketRun from '../../agents/runs/ticket-run';
import * as planStore from '../../agents/runs/plan-store';
import * as install from '../../agents/install/install';
import * as installSource from '../../agents/install/install-source';
import * as dryRun from '../../agents/runs/dry-run';

describe('@choliba/agents engine bridges', () => {
  it('keeps the provider contract available from its old module', () => {
    expect(agentProvider.AgentProvider).toBe(engine.AgentProvider);
  });

  it('keeps the prompt builders available from their old module', () => {
    expect(Object.values(prompt)).not.toContain(undefined);
    expect(prompt.wrapInstructions).toBe(engine.wrapInstructions);
    expect(prompt.buildUserPrompt).toBe(engine.buildUserPrompt);
  });

  it('keeps the permission helpers available from their old module', () => {
    expect(Object.values(agentPermissions)).not.toContain(undefined);
    expect(agentPermissions.absolutePermissions).toBe(domain.absolutePermissions);
    expect(agentPermissions.readAgentPermissions).toBe(domain.readAgentPermissions);
  });

  it('keeps the run-tool paths and listings available from their old modules', () => {
    expect(Object.values(runToolPath)).not.toContain(undefined);
    expect(Object.values(runTools)).not.toContain(undefined);
    expect(runToolPath.runToolPath).toBe(engine.runToolPath);
    expect(runTools.runToolsOf).toBe(engine.runToolsOf);
    expect(runTools.activeRunTools).toBe(engine.activeRunTools);
    expect(runTools.runToolLines).toBe(engine.runToolLines);
    expect(runTools.runToolCommands).toBe(engine.runToolCommands);
    expect(runTools.shortcutPath).toBe(engine.shortcutPath);
    expect(runTools.DELETE).toBe(engine.DELETE);
  });

  it('keeps the run preparation and choice available from their old modules', () => {
    expect(Object.values(providerRegistry)).not.toContain(undefined);
    expect(Object.values(agentSkills)).not.toContain(undefined);
    expect(Object.values(definedConfig)).not.toContain(undefined);
    expect(Object.values(invocation)).not.toContain(undefined);
    expect(Object.values(runChoice)).not.toContain(undefined);
    expect(Object.values(runPreparation)).not.toContain(undefined);
    expect(Object.values(runProject)).not.toContain(undefined);
    expect(providerRegistry.ProviderRegistry).toBe(engine.ProviderRegistry);
    expect(agentSkills.resolveSkills).toBe(engine.resolveSkills);
    expect(definedConfig.definedConfig).toBe(engine.definedConfig);
    expect(invocation.invocationFromAgent).toBe(engine.invocationFromAgent);
    expect(runChoice.agentRunChoice).toBe(engine.agentRunChoice);
    expect(runPreparation.prepareRun).toBe(engine.prepareRun);
    expect(runProject.withProjectDenies).toBe(engine.withProjectDenies);
  });

  it('keeps the ticket, plans and install available from their old modules', () => {
    expect(Object.values(ticketRun)).not.toContain(undefined);
    expect(Object.values(planStore)).not.toContain(undefined);
    expect(Object.values(install)).not.toContain(undefined);
    expect(Object.values(installSource)).not.toContain(undefined);
    expect(ticketRun.resolveTicketTarget).toBe(engine.resolveTicketTarget);
    expect(ticketRun.finishTicket).toBe(engine.finishTicket);
    expect(planStore.writePlan).toBe(engine.writePlan);
    expect(planStore.readPlan).toBe(engine.readPlan);
    expect(install.formatInstall).toBe(engine.formatInstall);
    expect(install.InstallError).toBe(engine.InstallError);
    expect(installSource.fetchSource).toBe(engine.fetchSource);
  });

  it('keeps the dry-run data available from its old module', () => {
    expect(Object.values(dryRun)).not.toContain(undefined);
    expect(typeof dryRun.formatDryRun).toBe('function');
    expect(typeof dryRun.modelText).toBe('function');
  });
});
