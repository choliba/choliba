import * as domain from '@choliba/domain';
import * as engine from '@choliba/engine';

import * as agentPermissions from '../../common/agent-permissions';
import * as agentProvider from '../../common/agent-provider';
import * as prompt from '../../common/prompt';
import * as runToolPath from '../../common/run-tools/run-tool-path';
import * as runTools from '../../common/run-tools/run-tools';

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
});
