import { exceptionPath, isException, type PathPolicy, type PathRule } from '@choliba/sandbox';

import type { AgentPermissions } from './agent-permissions';

/** One rule from an `allow` list and a `deny` list, the `deny`'s exceptions taken out into `exception`. */
function pathRule(allow: readonly string[], deny: readonly string[]): PathRule {
  return {
    allow,
    deny: deny.filter((path) => !isException(path)),
    exception: deny.filter(isException).map(exceptionPath),
  };
}

/**
 * The path policy the sandbox decides on, from an agent's permissions: `read` gives `read` and `list`, `write` gives
 * `create` and `edit`, and `delete` gives `delete`, so the agent reaches neither more nor less than before.
 */
export function pathPolicy(permissions: AgentPermissions): PathPolicy {
  const read = pathRule(permissions.allowRead, permissions.denyRead);
  const write = pathRule(permissions.allowWrite, permissions.denyWrite);
  return {
    read,
    list: read,
    create: write,
    edit: write,
    delete: pathRule(permissions.allowDelete, permissions.denyDelete),
  };
}
