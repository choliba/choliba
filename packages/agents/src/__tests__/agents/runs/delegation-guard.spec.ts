import { SUBAGENT_TOOLS, delegationMessage } from '../../../../../engine/src/guards/delegation-guard';

describe('SUBAGENT_TOOLS', () => {
  it('names the subagent tools: Agent in Claude Code, Task in Cursor', () => {
    expect(SUBAGENT_TOOLS).toEqual(['Agent', 'Task']);
  });
});

describe('delegationMessage', () => {
  it('says the run stopped and why', () => {
    expect(delegationMessage('Task')).toBe(
      '✗ o agente tentou delegar a um subagente (Task); a execução foi interrompida: nenhum agente do choliba delega trabalho.',
    );
  });
});
