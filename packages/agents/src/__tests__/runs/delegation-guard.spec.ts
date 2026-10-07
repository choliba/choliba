import { delegationMessage, delegationOf } from '../../runs/delegation-guard';

describe('delegationOf', () => {
  it('names the subagent tool a call uses: Agent in Claude Code, Task in Cursor', () => {
    expect(delegationOf({ type: 'tool-call', id: 'a', name: 'Agent', summary: '' })).toBe('Agent');
    expect(delegationOf({ type: 'tool-call', id: 'b', name: 'Task', summary: '' })).toBe('Task');
  });

  it('is undefined for any other tool and any other event', () => {
    expect(delegationOf({ type: 'tool-call', id: 'c', name: 'Read', summary: '' })).toBeUndefined();
    expect(delegationOf({ type: 'text', text: 'Agent' })).toBeUndefined();
  });
});

describe('delegationMessage', () => {
  it('says the run stopped and why', () => {
    expect(delegationMessage('Task')).toBe(
      '✗ o agente tentou delegar a um subagente (Task); a execução foi interrompida: nenhum agente do choliba delega trabalho.',
    );
  });
});
