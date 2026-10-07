import type { AgentDefinition, AgentSections, McpDeclaration } from '../agents/interfaces/agent.interface';
import type { ExecutionMode } from '../agents/interfaces/command.interface';
import type { ProviderRequest } from '../providers/interfaces/provider.interface';
import { type RunPlace, formatPermissions } from './permissions';
import { formatProject } from './run-project';
import { runToolLines } from './run-tools/run-tools';

/**
 * Linux's `MAX_ARG_STRLEN` is 128 KiB (131072 bytes) per argument, NUL included. One byte is
 * reserved for that terminator. The largest agent this package ships with compatibility for
 * (a typical agent's system prompt) is ~31 KB, comfortably under this — but a large
 * `--plan-from` file added on top of the instructions could approach it, so every provider
 * adapter checks before spawning rather than letting the OS reject the call.
 */
export const MAX_ARG_BYTES = 131_072 - 1;

export class PromptTooLargeError extends Error {}

/** One tag around `body`, on lines of their own. */
function tag(name: string, body: string): string {
  return [`<${name}>`, body.trim(), `</${name}>`].join('\n');
}

/** A list section: each entry in its own `<item>`-like tag; nothing when the list is empty. */
function listTag(name: string, itemName: string, items: readonly string[]): readonly string[] {
  return items.length === 0 ? [] : [tag(name, items.map((item) => tag(itemName, item)).join('\n'))];
}

/**
 * The agent's text (`agent.yaml`'s `role`, `context`, `input`, `flow`, `output`, `notes`) as the
 * prompt's sections, in that order; `context` and `notes` only when the agent has them.
 */
export function formatSections(sections: AgentSections): string {
  return [
    tag('system_role', sections.role),
    ...listTag('context', 'item', sections.context),
    tag('input_contract', sections.input),
    tag('execution_flow', sections.flow),
    tag('output_contract', sections.output),
    ...listTag('notes', 'note', sections.notes),
  ].join('\n\n');
}

function mcpBlock(mcp: McpDeclaration): string {
  const tools = mcp.tools === undefined ? 'every tool' : mcp.tools.join(', ');
  const open = `<mcp name="${mcp.name}" tools="${tools}">`;
  return mcp.instructions === undefined ? `${open}</mcp>` : [open, mcp.instructions.trim(), '</mcp>'].join('\n');
}

/**
 * The agent's MCP servers (`agent.yaml#mcps`): each with the tools it may call and how this agent
 * uses it (`instructions`). Nothing when the agent declares none: then nothing in the prompt names
 * a server or a tool.
 */
export function formatMcps(mcps: readonly McpDeclaration[]): string {
  if (mcps.length === 0) {
    return '';
  }
  return [
    '<mcps>',
    'Enforced by the command: these are the only MCP servers of this session, and each only has the tools listed.',
    ...mcps.map(mcpBlock),
    '</mcps>',
  ].join('\n');
}

/**
 * The agent's system prompt, built from `agent.yaml` alone: the order to use its skills
 * (`formatSkillsInstruction`), what it may read, write and run (`agent.yaml#permissions`, the same
 * data the provider enforces), its MCP servers (`formatMcps`), then its text (`formatSections`).
 * Only what the agent declares is there. States the agent's directory explicitly, because a text
 * may name relative paths that only resolve if the model knows where "here" is.
 */
export function wrapInstructions(agent: AgentDefinition, skillsInstruction = '', place?: RunPlace): string {
  const attr = (value: string): string => value.replaceAll('"', '&quot;');
  const mcps = formatMcps(agent.mcps);
  const project = formatProject(place?.project);
  return [
    `<agent_instructions id="${attr(agent.id)}" name="${attr(agent.displayName)}" version="${attr(agent.version)}" source="${attr(agent.sourcePath)}">`,
    ...(skillsInstruction === '' ? [] : [skillsInstruction, '']),
    formatPermissions(agent.permissions, place, runToolLines(agent.permissions, place), agent.mcps.length > 0),
    '',
    ...(project === '' ? [] : [project, '']),
    ...(mcps === '' ? [] : [mcps, '']),
    `Relative paths in the instructions below are relative to ${agent.dir}/.`,
    '',
    formatSections(agent.sections),
    '</agent_instructions>',
  ].join('\n');
}

/** Where a request runs, for `wrapInstructions`: its run folder, the workspace, its policy and its project. */
export function runPlaceOf(request: ProviderRequest): RunPlace {
  return {
    runDir: request.runDir,
    root: request.workspaceRoot,
    policy: request.policy,
    ...(request.project === undefined ? {} : { project: request.project }),
  };
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
