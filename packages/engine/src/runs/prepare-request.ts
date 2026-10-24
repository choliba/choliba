import { join } from 'node:path';

import type { AgentDefinition, ExecutionMode, McpServer } from '@choliba/domain';
import { agentURL, type Sandbox } from '@choliba/sandbox';
import { RUNS_DIR } from '@choliba/workspace';

import type { ProviderRequest } from '../ports';
import { buildUserPrompt } from '../prompt';
import { StepFailedError, stepExitCode } from '../steps';
import { effectivePolicy } from './invocation';
import type { AgentInvocation } from './invocation.interface';
import type { PrepareRunDeps, RunRequest, Stopped } from './run-context';
import { STOPPED, errorMessage, toAbsolute } from './run-context';

/**
 * Step 4: extra directories the provider may enter — the command's own, `--add-dir`, and the directories
 * `execute` names outside the workspace root (the provider cannot run a command in a folder it may not
 * enter). Entering a folder is not reading it: the providers run with every tool not allowed by a rule
 * denied, so what may be read there comes from `permissions` (`withReads`). Never fails.
 */
export function resolveAddDirs(
  command: AgentInvocation,
  parsed: RunRequest,
  deps: PrepareRunDeps,
  executeDirs: readonly string[],
): string[] {
  return [
    ...command.addDirs.map((dir) => toAbsolute(dir, deps.repoRoot)),
    ...parsed.addDirs.map((dir) => toAbsolute(dir, deps.repoRoot)),
    ...executeDirs,
  ];
}

/**
 * The prompt body from the command's `prepare` hook (the `before` steps of the mode, or their markers
 * on `--dry-run`) and the task it may have rewritten. A failed step stops the run with the step's own
 * exit code; the message says which step, what it ran and that the agent did not run.
 */
async function runPrepare(
  prepare: NonNullable<AgentInvocation['prepare']>,
  input: Parameters<NonNullable<AgentInvocation['prepare']>>[0],
  deps: PrepareRunDeps,
): Promise<{ templateOutput: string; effectiveTask: string } | Stopped> {
  try {
    const prepared = await prepare(deps.signal === undefined ? input : { ...input, signal: deps.signal });
    return { templateOutput: prepared.promptBody, effectiveTask: prepared.task };
  } catch (error) {
    if (error instanceof StepFailedError) {
      deps.stderr.write(`${error.message}\n  O agente não foi executado.\n`);
      return { exitCode: stepExitCode(error.failure) };
    }
    deps.stderr.write(`${errorMessage(error)}\n`);
    return STOPPED;
  }
}

/** Step 6: the actual `ProviderRequest`, via the command's `prepare` hook (or plain `prompt`) — and the task that hook may have rewritten. */
export async function buildProviderRequest(
  command: AgentInvocation,
  agent: AgentDefinition,
  mode: ExecutionMode,
  task: string,
  planContent: string | undefined,
  addDirs: readonly string[],
  skillsInstruction: string,
  mcpServers: readonly McpServer[],
  parsed: RunRequest,
  deps: PrepareRunDeps,
): Promise<{ effectiveTask: string; providerRequest: ProviderRequest } | Stopped> {
  const base = { task, repoRoot: deps.repoRoot, agent, mode, dryRun: parsed.dryRun };
  const prompted =
    command.prepare === undefined
      ? { templateOutput: command.prompt({ task, repoRoot: deps.repoRoot, agent }), effectiveTask: task }
      : await runPrepare(command.prepare, parsed.since === undefined ? base : { ...base, since: parsed.since }, deps);
  if ('exitCode' in prompted) {
    return prompted;
  }
  const { templateOutput, effectiveTask } = prompted;

  const providerRequest: ProviderRequest = {
    agent,
    mode,
    policy: effectivePolicy(command, mode),
    userPrompt: buildUserPrompt({
      templateOutput,
      mode,
      planContent,
      conclusions: deps.conclusions,
      sequence: deps.sessionAgents === undefined ? undefined : { self: agent.id, agents: deps.sessionAgents },
    }),
    workspaceRoot: deps.repoRoot,
    runDir: join(
      deps.runsDir ?? join(deps.repoRoot, RUNS_DIR),
      `${deps.now().toISOString().replaceAll(':', '-')}-${String(process.pid)}`,
    ),
    addDirs: [...addDirs],
    model: parsed.model,
    ...(skillsInstruction === '' ? {} : { skillsInstruction }),
    ...(mcpServers.length === 0 ? {} : { mcpServers }),
  };
  return { effectiveTask, providerRequest };
}

/** The server with its `url`, if it has one, as the agent reaches it (`agentURL`); a `command` server is unchanged. */
export function reachableMcp(server: McpServer, sandbox: Sandbox): McpServer {
  const url = server.config['url'];
  if (typeof url !== 'string') return server;
  return { ...server, config: { ...server.config, url: agentURL(url, sandbox) } };
}
