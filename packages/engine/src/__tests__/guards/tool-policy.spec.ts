import { toolPolicy } from '../../guards/tool-policy';

describe('toolPolicy', () => {
  it('allows each declared server, or only the tools it lists, and denies the subagent and unlimited tools', () => {
    expect(toolPolicy([{ name: 'git' }, { name: 'issues', tools: ['get_issue', 'list'] }], ['Grep'])).toEqual({
      allow: [{ server: 'git' }, { server: 'issues', name: 'get_issue' }, { server: 'issues', name: 'list' }],
      deny: [{ name: 'Agent' }, { name: 'Task' }, { name: 'Grep' }],
      exception: [],
    });
  });

  it('allows no tool to an agent that declares no MCP', () => {
    expect(toolPolicy([], []).allow).toEqual([]);
  });
});
