import { join } from 'node:path';

import { loadAgent } from '../agent-loader';
import { PhaseError, agentInPhase, phaseFlag, selectPhases } from '../phases';

const FIXTURES = join(__dirname, 'fixtures', 'agents');

describe('phases', () => {
  it('makes the agent one run of a phase: its instructions, policy and steps, the rest of the agent kept', async () => {
    const agent = await loadAgent(FIXTURES, 'with-phases');
    const [red, green] = agent.phases ?? [];
    if (red === undefined || green === undefined) throw new Error('fixture without phases');

    const inGreen = agentInPhase(agent, green);

    expect(phaseFlag(green)).toBe('--green');
    expect(inGreen).toMatchObject({ name: 'with-phases', instructions: green.instructions, beforeExecute: green.beforeExecute });
    expect(inGreen.phases).toBeUndefined();
    expect(inGreen.afterExecute).toBeUndefined();
    expect(agentInPhase(agent, red).beforeExecute).toBeUndefined();
  });

  it('stops when the project turns off every phase that would run', async () => {
    const phases = (await loadAgent(FIXTURES, 'with-phases')).phases ?? [];

    expect(() => selectPhases(phases, [], () => 'desligada')).toThrow(PhaseError);
    expect(() => selectPhases(phases, [], () => 'desligada')).toThrow('nenhuma fase para rodar');
  });
});
