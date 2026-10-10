import { claudeMcpUse } from '../../common/mcp-use';

describe('claudeMcpUse', () => {
  it('reads mcp__<server>__<tool> as a call to that tool of that server', () => {
    expect(claudeMcpUse('mcp__issues__get_issue', undefined)).toEqual({
      kind: 'call',
      server: 'issues',
      tool: 'get_issue',
    });
    expect(claudeMcpUse('mcp__git__log__all', undefined)).toEqual({ kind: 'call', server: 'git', tool: 'log__all' });
  });

  it('reads a server name with no tool, and the resource tools, as a discovery', () => {
    expect(claudeMcpUse('mcp__git', undefined)).toEqual({ kind: 'discovery', server: 'git' });
    expect(claudeMcpUse('ListMcpResourcesTool', 'git')).toEqual({ kind: 'discovery', server: 'git' });
    expect(claudeMcpUse('ReadMcpResourceTool', undefined)).toEqual({ kind: 'discovery' });
  });

  it('is undefined for any other tool', () => {
    expect(claudeMcpUse('Read', undefined)).toBeUndefined();
  });
});
