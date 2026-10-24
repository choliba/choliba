import {
  createAgentSequence,
  type AgentSequenceState,
  type SequenceAgent,
  type SequenceExecution,
  type SequenceResult,
  type SequenceStop,
} from '../../runs';

interface TestAgent extends SequenceAgent {
  readonly defaultTask?: string;
}

function setup(ids: string[] = ['first', 'second']) {
  const agents = new Map<string, TestAgent>([
    ['first', { id: 'first' }],
    ['second', { id: 'second', defaultTask: 'review' }],
    ['third', { id: 'third' }],
  ]);
  const runs: { readonly agent: string; readonly task: string }[] = [];
  const stops: SequenceStop[] = [];
  const states: AgentSequenceState[] = [];
  const releases: boolean[] = [];
  const codes: (number | undefined)[] = [];
  const confirmations: boolean[] = [];
  const conclusions: (string | undefined)[] = [];
  const told: (readonly SequenceResult[])[] = [];
  let run = (agent: TestAgent, task: string): Promise<number | undefined> => {
    runs.push({ agent: agent.id, task });
    return Promise.resolve(codes.shift() ?? 0);
  };
  let ticket: string | undefined;
  const sequence = createAgentSequence(
    () => ids,
    (id) => agents.get(id),
    (state) => states.push(state),
  );
  const execution: SequenceExecution<TestAgent> = {
    run: async (agent, task, others) => {
      told.push(others);
      const code = await run(agent, task);
      const conclusion = conclusions.shift();
      if (code === undefined) return undefined;
      return conclusion === undefined ? { code } : { code, conclusion };
    },
    continueTo: () => Promise.resolve(confirmations.shift() ?? true),
    ticket: () => ticket,
    before: () => undefined,
    missing: () => undefined,
    stopped: (stop) => stops.push(stop),
    hold: (multiple) => {
      releases.push(multiple);
      return () => releases.push(false);
    },
  };
  return {
    ids,
    runs,
    stops,
    states,
    releases,
    codes,
    confirmations,
    conclusions,
    told,
    sequence,
    execution,
    ticket: (value: string) => {
      ticket = value;
    },
    agents,
    replaceRun: (replacement: typeof run) => {
      run = replacement;
    },
  };
}

describe('createAgentSequence', () => {
  it('can expose its state without a change observer', () => {
    const sequence = createAgentSequence(
      () => [],
      () => undefined,
    );

    sequence.resetStop();

    expect(sequence.state().running).toBe(false);
  });

  it('runs agents in their current order and passes the first task to agents without a default', async () => {
    const test = setup();
    test.ids.push('third');
    test.ticket('site-3');

    await test.sequence.start(0, 'build', test.execution);

    expect(test.runs).toEqual([
      { agent: 'first', task: 'build' },
      { agent: 'second', task: 'review' },
      { agent: 'third', task: 'build' },
    ]);
    expect(test.sequence.state().running).toBe(false);
    expect(test.sequence.state().results.every((result) => result.ticket === 'site-3')).toBe(true);
    expect(test.releases).toEqual([true, false]);
  });

  it('stops on failure and resumes with the remembered first task', async () => {
    const test = setup();
    test.codes.push(1);

    await test.sequence.start(0, 'build', test.execution);
    expect(test.stops).toEqual([{ at: 0, agent: 'first', reason: 'failed' }]);
    expect(test.sequence.state().resumeAt).toBe(0);

    await test.sequence.start(0, undefined, test.execution);
    expect(test.runs.at(-2)).toEqual({ agent: 'first', task: 'build' });
  });

  it('tells each run what the earlier runs of the session concluded, a failed one too, across a resume', async () => {
    const test = setup();
    test.codes.push(0, 1);
    test.conclusions.push('o ticket está pronto', 'parei: o CA-01 não é testável');

    await test.sequence.start(0, 'build', test.execution);
    const first = {
      agent: 'first',
      task: 'build',
      reason: 'completed',
      exitCode: 0,
      conclusion: 'o ticket está pronto',
    };
    const second = {
      agent: 'second',
      task: 'review',
      reason: 'failed',
      exitCode: 1,
      conclusion: 'parei: o CA-01 não é testável',
    };
    expect(test.told).toEqual([[], [first]]);
    expect(test.sequence.state().history).toEqual([first, second]);

    await test.sequence.start(0, 'veja o que o second disse', test.execution);
    expect(test.told[2]).toEqual([first, second]);
    expect(test.sequence.state().results.map((result) => result.agent)).toEqual(['first', 'second']);
    expect(test.sequence.state().history).toHaveLength(4);
  });

  it('forgets the runs of a session it is told to forget', async () => {
    const test = setup(['first']);
    test.conclusions.push('feito');

    await test.sequence.start(0, 'build', test.execution);
    test.sequence.forget();
    await test.sequence.start(0, 'build', test.execution);

    expect(test.told).toEqual([[], []]);
    expect(test.sequence.state().history).toEqual([
      { agent: 'first', task: 'build', reason: 'completed', exitCode: 0 },
    ]);
  });

  it('stops before the next agent when continuing is declined', async () => {
    const test = setup();
    test.confirmations.push(false);

    await test.sequence.start(0, 'build', test.execution);

    expect(test.runs).toEqual([{ agent: 'first', task: 'build' }]);
    expect(test.stops).toEqual([{ at: 1, agent: 'second', reason: 'declined' }]);
    expect(test.states.some((state) => state.pending?.kind === 'continue')).toBe(true);
  });

  it('records a missing agent and an interrupted run as reasons to resume', async () => {
    const missing = setup(['gone', 'first']);
    await missing.sequence.start(0, 'build', missing.execution);
    expect(missing.sequence.state().results[0]).toMatchObject({ agent: 'gone', reason: 'missing' });

    const interrupted = setup();
    interrupted.replaceRun(() => {
      interrupted.sequence.interrupt();
      return Promise.resolve(0);
    });
    await interrupted.sequence.start(0, 'build', interrupted.execution);
    expect(interrupted.stops).toEqual([{ at: 0, agent: 'first', reason: 'interrupted' }]);
  });

  it('does not resume a sequence cleared while an agent is running', async () => {
    const test = setup();
    test.replaceRun(() => {
      test.ids.length = 0;
      test.sequence.interrupt();
      return Promise.resolve(1);
    });

    await test.sequence.start(0, 'build', test.execution);

    expect(test.sequence.state().resumeAt).toBeUndefined();
    expect(test.stops).toEqual([]);
  });

  it('exposes an agent question as pending state', () => {
    const test = setup();
    const question = { id: 'choice', question: 'Qual?', options: ['um'], multi: false };

    test.sequence.question(question);
    expect(test.sequence.state().pending).toEqual({ kind: 'agent', question });
    test.sequence.question(undefined);
    expect(test.sequence.state().pending).toBeUndefined();
  });
});
