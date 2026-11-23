/**
 * A whole round record for the pages' tests: one agent, `po`, on Ollama,
 * with what each test changes given in `extra`.
 */

import type { RoundRecord } from '../../src/rounds/types';

const none = {
  input: null,
  output: null,
  cacheRead: null,
  cacheWrite: null,
  reasoning: null,
};

/** A round of `testId`, its agent on `model` through `cli`, lasting `ms`. */
export function roundRecord({
  id = '1',
  testId = 'teste',
  model = 'qwen3.5:4b',
  cli = null,
  ms = 1000,
  extra = {},
}: {
  readonly id?: string;
  readonly testId?: string;
  readonly model?: string;
  readonly cli?: string | null;
  readonly ms?: number;
  readonly extra?: Partial<RoundRecord>;
}): RoundRecord {
  const span = {
    startedAt: `2026-11-05T10:00:0${id}.000Z`,
    endedAt: `2026-11-05T10:01:0${id}.000Z`,
    durationMs: ms,
  };
  return {
    schema: 4,
    id,
    definition: { id: testId, goal: 'g' },
    start: null,
    repeat: { index: 1, total: 1 },
    timing: {
      ...span,
      actors: {
        po: { ...span, workspaceMs: null, gitCheckMs: null, approvalMs: null },
      },
    },
    actors: {
      po: {
        role: 'po',
        provider: {
          id: 'ollama',
          name: 'ollama',
          model,
          cli,
          cliVersion: null,
          options: {},
        },
        workspace: {
          type: 'bubblewrap',
          image: null,
          root: '<projeto>',
          writable: [],
          hostState: 'none',
          ports: [],
        },
        network: {
          rules: null,
          alwaysAllow: [],
          alwaysDeny: [],
          decisions: [],
        },
        policy: null,
        readOnly: false,
        configHash: model,
      },
    },
    configHash: `${model}-${cli ?? ''}`,
    steps: [],
    usage: [],
    totals: {
      round: { tokens: none, fresh: null, costUsd: null },
      actors: { po: { tokens: none, fresh: null, costUsd: null } },
    },
    measures: {},
    violations: [],
    ...extra,
  };
}
