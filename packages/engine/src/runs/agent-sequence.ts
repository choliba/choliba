export interface SequenceAgent {
  readonly id: string;
  readonly defaultTask?: string | undefined;
}

export type SequenceStopReason = 'declined' | 'failed' | 'interrupted' | 'missing' | 'not-started';

export interface SequenceResult {
  readonly agent: string;
  readonly task: string;
  readonly reason: 'completed' | SequenceStopReason;
  readonly exitCode?: number | undefined;
  readonly ticket?: string | undefined;
}

export interface SequencePrompt {
  readonly question: string;
  readonly options: readonly string[];
  readonly multi: boolean;
}

export type SequenceQuestion =
  { readonly kind: 'agent'; readonly question: SequencePrompt } | { readonly kind: 'continue'; readonly agent: string };

export interface AgentSequenceState {
  readonly running: boolean;
  readonly current?: string | undefined;
  readonly resumeAt?: number | undefined;
  readonly pending?: SequenceQuestion | undefined;
  readonly results: readonly SequenceResult[];
}

export interface SequenceStop {
  readonly at: number;
  readonly agent: string;
  readonly reason: SequenceStopReason;
}

export interface SequenceExecution<Agent extends SequenceAgent> {
  readonly run: (agent: Agent, task: string) => Promise<number | undefined>;
  readonly continueTo: (agent: string) => Promise<boolean>;
  readonly ticket: () => string | undefined;
  readonly before: (agents: readonly string[]) => void;
  readonly missing: (agent: string) => void;
  readonly stopped: (stop: SequenceStop) => void;
  readonly hold: (multiple: boolean) => () => void;
}

export interface AgentSequence<Agent extends SequenceAgent> {
  readonly start: (from: number, task: string | undefined, execution: SequenceExecution<Agent>) => Promise<void>;
  readonly state: () => AgentSequenceState;
  readonly interrupt: () => void;
  readonly question: (question: SequencePrompt | undefined) => void;
  readonly resetStop: () => void;
}

export function createAgentSequence<Agent extends SequenceAgent>(
  agentIds: () => readonly string[],
  loadAgent: (id: string) => Agent | undefined,
  changed: (state: AgentSequenceState) => void = noopChanged,
): AgentSequence<Agent> {
  let running = false;
  let current: string | undefined;
  let resumeAt: number | undefined;
  let pending: SequenceQuestion | undefined;
  let interrupted = false;
  let firstTask = '';
  let results: readonly SequenceResult[] = [];

  const state = (): AgentSequenceState => ({ running, current, resumeAt, pending, results });
  const notify = (): void => {
    changed(state());
  };
  const setPending = (question: SequenceQuestion | undefined): void => {
    pending = question;
    notify();
  };
  const stopAt = (execution: SequenceExecution<Agent>, at: number, reason: SequenceStopReason): void => {
    const ids = agentIds();
    const agent = ids[at];
    resumeAt = ids.length < 2 || agent === undefined ? undefined : at;
    if (agent !== undefined) execution.stopped({ at, agent, reason });
    notify();
  };

  const runFrom = async (
    from: number,
    task: string | undefined,
    execution: SequenceExecution<Agent>,
  ): Promise<void> => {
    if (running) return;
    const initial = agentIds();
    running = true;
    interrupted = false;
    resumeAt = undefined;
    results = [];
    if (task !== undefined && from === 0) firstTask = task;
    execution.before(initial.slice(from));
    const release = execution.hold(initial.length > 1);
    notify();
    try {
      await runAgents(from, task, execution);
    } finally {
      running = false;
      current = undefined;
      pending = undefined;
      release();
      notify();
    }
  };

  const runAgents = async (
    from: number,
    task: string | undefined,
    execution: SequenceExecution<Agent>,
  ): Promise<void> => {
    for (let at = from, id = agentIds()[at]; id !== undefined; at += 1, id = agentIds()[at]) {
      const agent = loadAgent(id);
      if (agent === undefined) {
        execution.missing(id);
        record(id, '', 'missing', undefined, execution.ticket());
        stopAt(execution, at, 'missing');
        return;
      }
      current = id;
      notify();
      const ownTask = at === from ? task : undefined;
      const effectiveTask = ownTask ?? agent.defaultTask ?? firstTask;
      const code = await execution.run(agent, effectiveTask);
      current = undefined;
      const reason = resultReason(code, interrupted);
      record(id, effectiveTask, reason, code, execution.ticket());
      notify();
      if (reason !== 'completed') {
        stopAt(execution, at, reason);
        return;
      }
      const next = agentIds()[at + 1];
      if (next !== undefined && !(await confirmNext(next, execution))) {
        stopAt(execution, at + 1, 'declined');
        return;
      }
    }
  };

  const record = (
    agent: string,
    task: string,
    reason: SequenceResult['reason'],
    exitCode: number | undefined,
    ticket: string | undefined,
  ): void => {
    results = [
      ...results,
      {
        agent,
        task,
        reason,
        ...(exitCode === undefined ? {} : { exitCode }),
        ...(ticket === undefined ? {} : { ticket }),
      },
    ];
  };

  const confirmNext = async (next: string, execution: SequenceExecution<Agent>): Promise<boolean> => {
    setPending({ kind: 'continue', agent: next });
    try {
      return await execution.continueTo(next);
    } finally {
      setPending(undefined);
    }
  };

  return {
    start: runFrom,
    state,
    interrupt: () => {
      interrupted = true;
      notify();
    },
    question: (question) => {
      setPending(question === undefined ? undefined : { kind: 'agent', question });
    },
    resetStop: () => {
      resumeAt = undefined;
      notify();
    },
  };
}

function resultReason(code: number | undefined, interrupted: boolean): SequenceResult['reason'] {
  if (interrupted) return 'interrupted';
  if (code === undefined) return 'not-started';
  return code === 0 ? 'completed' : 'failed';
}

function noopChanged(): void {
  // The state is available through `state` when nobody observes every transition.
}
