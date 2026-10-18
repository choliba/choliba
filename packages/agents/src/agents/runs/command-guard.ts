import { isAbsolute, join } from 'node:path';

import { isWithin, withoutTrailingSlash } from '@choliba/sandbox';

import {
  absolutePermissions,
  allowedCommands,
  blocksEveryCommand,
  EVERY_COMMAND,
  runToolCommands,
  runToolsOf,
  type ProviderRequest,
} from '../../common';

/** The commands an agent may run, for a provider whose own permissions cannot limit them. */
export interface CommandRules {
  readonly allowed: readonly string[];
  readonly denied: readonly string[];
  /** The directories a deny of every command (`['*']`) covers: no `cd` into them. */
  readonly closedDirs: readonly string[];
  /** Where the commands start, which a relative `cd` is relative to. */
  readonly cwd: string;
}

/** The commands of `request`'s agent, as Claude takes them: `permissions.execute` and the run tools. */
export function commandRules(request: ProviderRequest): CommandRules {
  const permissions = absolutePermissions(request.agent.permissions, request.workspaceRoot);
  const runTools = runToolCommands(runToolsOf(request));
  const denyRules = permissions.denyExecute;
  return {
    allowed: [...allowedCommands(permissions), ...runTools.allow],
    denied: [
      ...denyRules.filter((rule) => !blocksEveryCommand(rule)).flatMap((rule) => rule.commands),
      ...runTools.deny,
    ],
    closedDirs: denyRules.filter(blocksEveryCommand).map((rule) => withoutTrailingSlash(rule.dir)),
    cwd: request.runDir,
  };
}

/** The shell Codex wraps a command in: `/bin/bash -lc`. */
const SHELL_WRAPPER = /^(?:\S*\/)?(?:ba|z)?sh\s+-l?c\s+/;

/** `bash -lc '<script>'`, as Codex reports a command: the script; any other command as it is. */
function scriptOf(command: string): string {
  const trimmed = command.trim();
  const body = trimmed.replace(SHELL_WRAPPER, '');
  if (body === trimmed) return trimmed;
  const quote = body[0];
  if ((quote !== "'" && quote !== '"') || !body.endsWith(quote) || body.length < 2) return body;
  const inner = body.slice(1, -1);
  // Inside '…', a quote is written '\''; inside "…", \" and \\.
  return quote === "'" ? inner.replaceAll("'\\''", "'") : inner.replace(/\\(["\\$`])/g, '$1');
}

const OPERATORS: readonly string[] = ['&&', '||', ';', '|', '&', '\n'];

/** The commands of a shell line, split at its operators outside quotes. */
function segmentsOf(script: string): readonly string[] {
  const segments: string[] = [];
  let current = '';
  let quote: string | undefined;
  for (let index = 0; index < script.length; index += 1) {
    const char = script.charAt(index);
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
      current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    const operator = OPERATORS.find((op) => script.startsWith(op, index));
    if (operator === undefined) {
      current += char;
      continue;
    }
    segments.push(current);
    current = '';
    index += operator.length - 1;
  }
  segments.push(current);
  return segments.map((segment) => segment.trim()).filter((segment) => segment !== '');
}

/** Whether `segment` is `command` or `command` with arguments, as Claude's `Bash(command:*)`. */
function runs(segment: string, command: string): boolean {
  return segment === command || segment.startsWith(`${command} `);
}

function unquoted(text: string): string {
  return text.replace(/^['"]|['"]$/g, '');
}

/** Why a `cd` breaks the rules: it enters a directory where every command is denied. */
function cdViolation(segment: string, rules: CommandRules): string | undefined {
  const target = unquoted(segment.slice('cd'.length).trim());
  if (target === '') return undefined;
  const dir = isAbsolute(target) ? target : join(rules.cwd, target);
  return rules.closedDirs.some((closed) => isWithin(closed, dir)) ? `cd ${target}` : undefined;
}

/**
 * The commands that only read, list or search, which any agent may run whatever its `permissions.execute`: the
 * sandbox already mounts only the paths it may read, and a provider with no tool of its own to read (Codex) reads
 * with them. `sed` only as `sed -n '<start>,<end>p'`.
 */
export const READ_COMMANDS: readonly string[] = ['cat', 'head', 'tail', 'ls', 'wc', 'nl', 'grep', 'rg', 'find', 'pwd'];

/** The options that make a reading command run another program or write: `find -exec`, `rg --pre`. */
const RUNS_OR_WRITES: Readonly<Record<string, RegExp>> = {
  find: /(^|\s)-(exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)(\s|$)/,
  rg: /(^|\s)(--pre|--pre-glob|-z|--search-zip)(=|\s|$)/,
};

/** `sed -n '10,20p'`, `sed -n '5p'` or `sed -n "1,$p"`: the only `sed` that only reads. */
const SED_PRINT = /^sed -n (['"]?)\d+(,(\d+|\$))?p\1(\s|$)/;

/** Whether `segment` only reads: a command of `READ_COMMANDS` without an option that runs or writes. */
function readsOnly(segment: string): boolean {
  if (segment.startsWith('sed ')) return SED_PRINT.test(segment);
  const program = segment.replace(/\s.*$/s, '');
  if (!READ_COMMANDS.includes(program)) return false;
  return !(RUNS_OR_WRITES[program]?.test(segment) ?? false);
}

function segmentViolation(segment: string, rules: CommandRules): string | undefined {
  if (segment === 'cd' || segment.startsWith('cd ')) return cdViolation(segment, rules);
  if (rules.denied.some((command) => runs(segment, command))) return segment;
  if (readsOnly(segment)) return undefined;
  if (rules.allowed.includes(EVERY_COMMAND)) return undefined;
  return rules.allowed.some((command) => runs(segment, command)) ? undefined : segment;
}

/**
 * Why `command`, run by a provider whose own permissions cannot limit commands (Codex), breaks the agent's
 * `permissions.execute`, or `undefined` when every command in it is allowed or only reads (`READ_COMMANDS`). Strict on
 * purpose: a substitution (`$(…)`, backticks) or a command none of the rules allows stops the run, as Claude would
 * refuse it.
 */
export function commandViolation(command: string, rules: CommandRules): string | undefined {
  const script = scriptOf(command);
  if (/\$\(|`|<\(|>\(/.test(script)) {
    return `✗ o agente rodou um comando com substituição, que as permissões não conseguem conferir: ${script}; a execução foi interrompida.`;
  }
  for (const segment of segmentsOf(script)) {
    const violation = segmentViolation(segment, rules);
    if (violation !== undefined) {
      return `✗ o agente rodou ${violation}, fora de permissions.execute; a execução foi interrompida.`;
    }
  }
  return undefined;
}
