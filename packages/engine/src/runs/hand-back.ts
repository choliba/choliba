import { HAND_BACK } from '../prompt';

/** The agent a run handed the work back to, and why. */
export interface HandBack {
  readonly agent: string;
  readonly why: string;
}

/** `Hand back to: <agent> — <why>`, the agent's name bare, in backticks or in bold, the dash or a colon before why. */
const LINE = new RegExp(`^[\\s*_]*${HAND_BACK}[\\s*_\`]*([a-z0-9][a-z0-9_-]*)[\\s*_\`]*(?:[—–:-]\\s*)?(.*)$`, 'i');

/**
 * The agent `self` handed the work back to in its `conclusion`: the last `Hand back to:` line that names another of the
 * session's `agents`; nothing when it names none, itself, or one outside the session.
 */
export function handBackOf(
  conclusion: string | undefined,
  self: string,
  agents: readonly string[],
): HandBack | undefined {
  const lines = (conclusion ?? '').split('\n').reverse();
  const line = lines.find((each) => LINE.test(each));
  if (line === undefined) return undefined;
  const agent = line.replace(LINE, '$1').toLowerCase();
  if (agent === self || !agents.includes(agent)) return undefined;
  return {
    agent,
    why: line
      .replace(LINE, '$2')
      .replace(/[*_]+$/, '')
      .trim(),
  };
}
