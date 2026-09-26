import type { AgentDefinition } from './agent.types';
import type { ExecutionMode } from './command.types';

/**
 * Linux's `MAX_ARG_STRLEN` is 128 KiB (131072 bytes) per argument, NUL included. One byte is
 * reserved for that terminator. The largest agent this package ships with compatibility for
 * (a typical agent's `system.md`) is ~31 KB, comfortably under this — but a large
 * `--plan-from` file added on top of the instructions could approach it, so every provider
 * adapter checks before spawning rather than letting the OS reject the call.
 */
export const MAX_ARG_BYTES = 131_072 - 1;

export class PromptTooLargeError extends Error {}

/**
 * Wraps an agent's `system.md` for inlining into a prompt (there is no `--system-prompt`
 * equivalent for every provider — see `providers/cursor/index.ts`). States the agent's directory
 * explicitly, because `system.md` files may contain relative paths that only resolve if the model
 * knows where "here" is. The order to use the agent's skills (`formatSkillsInstruction`), when there
 * is one, comes first.
 */
export function wrapInstructions(agent: AgentDefinition, skillsInstruction = ''): string {
  const attr = (value: string): string => value.replaceAll('"', '&quot;');
  return [
    `<agent_instructions id="${attr(agent.id)}" name="${attr(agent.displayName)}" version="${attr(agent.version)}" source="${attr(agent.systemPromptPath)}">`,
    ...(skillsInstruction === '' ? [] : [skillsInstruction, '']),
    `Relative paths in the instructions below are relative to ${agent.dir}/.`,
    '',
    agent.instructions,
    '</agent_instructions>',
  ].join('\n');
}

/**
 * `plan` and `ask` both run with read-only tools (see `effectivePolicy`), which a model that
 * is not told so may try to work around by writing fake tool-call syntax as plain text instead
 * of just answering — the exact failure this package's `packages/testando` sandbox chat hit
 * before its tools were scoped down. Spelling it out in the prompt heads that off.
 */
export function modeInstruction(mode: ExecutionMode): string {
  if (mode === 'execute') {
    return '';
  }
  const goal = mode === 'plan' ? 'Produce a plan; do not execute it.' : 'Answer the question below.';
  return `You have read-only tools in this session (no edits, no writes). ${goal}`;
}

export interface BuildUserPromptOptions {
  /** The command's `prompt(input)` output — usually just the task, sometimes a template around it. */
  readonly templateOutput: string;
  readonly mode: ExecutionMode;
  /** The contents of a saved plan, when running with `--plan-from`. */
  readonly planContent: string | undefined;
}

/**
 * Assembles the part of the prompt that is not the agent's instructions: the mode's
 * read-only notice (if any), a previously saved plan (if resuming one) and the task. The agent's
 * skills go with its instructions instead (`wrapInstructions`). Always starts with non-flag-like text (a literal header,
 * never the task verbatim first), so a task that happens to start with "-" can never be mistaken
 * by a CLI arg parser for a flag.
 */
export function buildUserPrompt(options: BuildUserPromptOptions): string {
  const parts: string[] = [];
  const mode = modeInstruction(options.mode);
  if (mode !== '') {
    parts.push(mode);
  }
  if (options.planContent !== undefined) {
    parts.push(`Previously saved plan:\n${options.planContent}`);
  }
  parts.push(`Task:\n${options.templateOutput}`);
  return parts.join('\n\n');
}

/**
 * Throws `PromptTooLargeError`, naming which argument and by how much, the first time an
 * argument would exceed what the OS accepts for `execve`. Checked once per adapter, right
 * before it hands its args back to the runner — not deep inside spawn, where the failure
 * would be an opaque `ENOMEM`/`E2BIG` from the kernel instead of an actionable message.
 */
export function assertArgvFits(args: readonly string[]): void {
  args.forEach((arg, index) => {
    const bytes = Buffer.byteLength(arg, 'utf8');
    if (bytes > MAX_ARG_BYTES) {
      throw new PromptTooLargeError(
        `argument ${String(index)} is ${String(bytes)} bytes, over the ${String(MAX_ARG_BYTES)}-byte limit`,
      );
    }
  });
}
