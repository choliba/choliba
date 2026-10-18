import { AgentProvider } from '../../common';
import type { ProviderRequest, ProviderVariablesInput, StreamParser } from '../../common';
import { assertArgvFits, runPlaceOf, wrapInstructions } from '../../common';
import { prepareCodexAuthentication, runCodexHome } from './codex-auth';
import { codexMcpArgs } from './codex-config';
import { createCodexStreamParser } from './codex-stream';

/** How Codex, which reads with the shell, reads without stopping the run (`READ_COMMANDS` of `command-guard.ts`). */
const READ_LINE =
  "Read, list and search files only with cat, head, tail, ls, wc, nl, grep, rg, find (never with -exec or -delete) and sed -n '<start>,<end>p'. Run any other program only as your execute permissions allow: a command outside them stops the run.";

function buildArgs(request: ProviderRequest): readonly string[] {
  const instructions = [
    wrapInstructions(request.agent, request.skillsInstruction, runPlaceOf(request)),
    READ_LINE,
  ].join('\n\n');
  const args: string[] = [
    '--dangerously-bypass-approvals-and-sandbox',
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '-C',
    request.workspaceRoot,
    '-c',
    `developer_instructions=${JSON.stringify(instructions)}`,
  ];
  if (request.model !== undefined) args.push('--model', request.model);
  for (const dir of request.addDirs) args.push('--add-dir', dir);
  args.push(...codexMcpArgs(request.mcpServers ?? []), '-');
  assertArgvFits(args);
  return args;
}

/**
 * The npm launcher resolves the native platform package beside `@openai/codex`. A local sandbox
 * hides the user's home, so the package scope must be mounted together. A standalone native binary
 * has no package tree and needs only its own file.
 */
function codexRuntime(executable: string): string {
  const packageMarker = '/@openai/codex/';
  const markerIndex = executable.lastIndexOf(packageMarker);
  if (markerIndex < 0) return executable;
  return executable.slice(0, markerIndex + '/@openai'.length);
}

/**
 * Codex CLI (`codex exec --json`). Its own sandbox is off: it runs inside choliba's (`bwrap` or the container), which
 * mounts only what the agent's permissions reach. Codex limits no command, so choliba checks each one against
 * `permissions.execute` (`enforcesExecute`); and its stream does not say the model, so a run always names one
 * (`needsModel`). It authenticates with the session of `codex login`, copied to the run's `CODEX_HOME`.
 */
export class CodexAgentProvider extends AgentProvider {
  readonly id = 'codex';
  readonly binaries: readonly (readonly [string, ...string[]])[] = [['codex']];
  /** After Cursor and before Claude in `auto`. */
  readonly autoPriority = 2;
  /** None in the environment: the session of `codex login`, which `prepareWorkspace` copies, or says is missing. */
  readonly credentials: readonly string[] = [];
  readonly credentialHelp = 'O provider codex precisa de uma sessão autenticada: rode `codex login`.';
  override readonly oneShotInput = true;
  override readonly enforcesExecute = false;
  override readonly needsModel = true;

  buildArgs(request: ProviderRequest): readonly string[] {
    return buildArgs(request);
  }

  override variables({ request }: ProviderVariablesInput): Readonly<Record<string, string>> {
    return { CODEX_HOME: runCodexHome(request.runDir) };
  }

  override localReadOnly(executable: string): readonly string[] {
    return [codexRuntime(executable)];
  }

  override inputMessage(text: string): string {
    return `${text}\n`;
  }

  override quietStderr(line: string): boolean {
    return line.trim() === 'Reading additional input from stdin...';
  }

  createParser(): StreamParser {
    return createCodexStreamParser();
  }

  override prepareWorkspace(request: ProviderRequest): () => void {
    return prepareCodexAuthentication(request.runDir);
  }
}
