import * as domain from '@choliba/domain';

import * as agentMcps from '../../common/agent-mcps';
import * as agentVars from '../../common/agent-vars';

describe('@choliba/agents domain bridges', () => {
  it('keeps every variable export available from its old module', () => {
    expect(Object.values(agentVars)).not.toContain(undefined);
    expect(agentVars.expandVars).toBe(domain.expandVars);
    expect(agentVars.PROJECT_VARS).toBe(domain.PROJECT_VARS);
  });

  it('keeps the pure MCP exports available beside the file resolver', () => {
    expect(Object.values(agentMcps)).not.toContain(undefined);
    expect(agentMcps.mcpConfig).toBe(domain.mcpConfig);
    expect(agentMcps.McpError).toBe(domain.McpError);
  });
});
