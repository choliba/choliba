import type { AgentDefinition } from '@choliba/domain';
import { absolutePermissions, canRead, definitionExceptionProblems, outsideExecuteDirs } from '@choliba/domain';
import { strayExceptions } from '@choliba/sandbox';

import type { PrepareRunDeps, RunRequest } from './run-context';
import { undeclaredModel } from './run-choice';

/**
 * Pre-flight: when `--model` is explicit, one of the agent's providers must declare it — checked before resolving a
 * provider or building a prompt, so a model the agent does not declare never gets near one. `true` means "ok to
 * proceed"; on `false` the error, naming what the agent declares, has already been written to `stderr`.
 */
export function checkModelSupported(parsed: RunRequest, agent: AgentDefinition, deps: PrepareRunDeps): boolean {
  const model = parsed.model;
  if (model === undefined || agent.providers.some(({ models }) => models.includes(model))) {
    return true;
  }
  deps.stderr.write(`${undeclaredModel(agent, model)}\n`);
  return false;
}

/**
 * The directories `execute` names outside the workspace root, each of which must be readable: a command
 * run in a folder reaches what is in it anyway, and a provider can only enter a folder it may read freely.
 * `undefined` when one is not; the reason is already on `stderr`.
 */
export function checkedExecuteDirs(agent: AgentDefinition, deps: PrepareRunDeps): readonly string[] | undefined {
  const permissions = absolutePermissions(agent.permissions, deps.repoRoot);
  const dirs = outsideExecuteDirs(permissions, deps.repoRoot);
  const unreadable = dirs.filter((dir) => !canRead(permissions, dir));
  if (unreadable.length === 0) {
    return dirs;
  }
  deps.stderr.write(
    `"${agent.name}" runs commands in ${unreadable.join(', ')}, which permissions.allow.read does not cover: ` +
      'add the folder to allow.read (running commands in it reaches what is there anyway).\n',
  );
  return undefined;
}

/**
 * Every `!` exception in `deny.read`, `deny.write` and `deny.delete` must lie under a deny of the same list: one
 * that does not takes nothing out, which is a mistake in `agent.yaml`. `false` when one does not; the reason is
 * already on `stderr`.
 */
export function checkedDenyExceptions(agent: AgentDefinition, deps: PrepareRunDeps): boolean {
  const permissions = absolutePermissions(agent.permissions, deps.repoRoot);
  const lists: readonly (readonly [string, readonly string[]])[] = [
    ['read', permissions.denyRead],
    ['write', permissions.denyWrite],
    ['delete', permissions.denyDelete],
  ];
  const problems = lists.flatMap(([key, entries]) =>
    strayExceptions(entries).map(
      (path) => `  exception.${key}: ${path} não está dentro de nenhum caminho de deny.${key} (uma pasta, sem glob)`,
    ),
  );
  if (problems.length === 0) {
    return true;
  }
  deps.stderr.write(
    `"${agent.name}" tem exceções que não tiram nada de um deny:\n${problems.join('\n')}\n` +
      'Corrija o caminho da exceção ou remova a linha do agent.yaml.\n',
  );
  return false;
}

/**
 * A `!` in `deny.write` or `deny.delete` must not sit on the agent, skill or MCP folders, nor inside them:
 * those denies are imposed on every run, and an exception there would reopen a definition. `false` when one
 * does; the reason is already on `stderr`. `deny.read` is not checked: a declared skill stays readable.
 */
export function checkedDefinitionExceptions(
  agent: AgentDefinition,
  directories: readonly string[],
  deps: PrepareRunDeps,
): boolean {
  const problems = definitionExceptionProblems(absolutePermissions(agent.permissions, deps.repoRoot), directories);
  if (problems.length === 0) {
    return true;
  }
  deps.stderr.write(
    `"${agent.name}" reabre pastas de definição que o choliba protege:\n${problems.join('\n')}\n` +
      'Uma exception não pode ficar dentro das pastas de agentes, skills ou MCPs.\n',
  );
  return false;
}
