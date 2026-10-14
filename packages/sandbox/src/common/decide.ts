import type {
  PathAction,
  PathPolicy,
  PermissionEffect,
  PermissionObject,
  PermissionPolicy,
  PermissionRequest,
  ToolEntry,
  ToolPolicy,
  WriteAction,
} from './interfaces/permission-decision.interface';
import { PATH_ACTIONS, WRITE_ACTIONS } from './interfaces/permission-decision.interface';
import { withoutTrailingSlash } from './paths';
import { isWithin } from './resolve-denies';
import { ruleEffect } from './rule-effect';

/** Whether `path` is `root` or lies under it. A trailing slash does not change the folder. */
function coversPath(root: string, path: string): boolean {
  return isWithin(withoutTrailingSlash(root), withoutTrailingSlash(path));
}

/** Whether `outer` is `inner` or, having no name, its whole server. No server is a server of its own: the built-ins. */
function coversTool(outer: ToolEntry, inner: ToolEntry): boolean {
  if (outer.server !== inner.server) return false;
  return outer.name === undefined || outer.name === inner.name;
}

function isPathAction(action: PermissionRequest['action']): action is PathAction {
  return (PATH_ACTIONS as readonly string[]).includes(action);
}

function isWriteAction(action: PathAction): action is WriteAction {
  return (WRITE_ACTIONS as readonly string[]).includes(action);
}

/** A `plan` or `ask` run keeps no write, whatever `allow` says. */
function writeBlocked(mode: PermissionRequest['context']['mode'], action: PathAction): boolean {
  if (mode === 'execute') return false;
  return isWriteAction(action);
}

function decidePath(request: PermissionRequest, action: PathAction, policy: PathPolicy): PermissionEffect {
  if (request.object.kind !== 'path') return 'deny';
  if (writeBlocked(request.context.mode, action)) return 'deny';
  return ruleEffect(policy[action], request.object.path, coversPath);
}

/** `plan` and `ask` do not block a tool: what it may do is the tool policy's, and its paths are asked on their own. */
function decideTool(object: PermissionObject, policy: ToolPolicy): PermissionEffect {
  if (object.kind !== 'tool') return 'deny';
  return ruleEffect(policy, object, coversTool);
}

/**
 * `allow` or `deny` for one request. Denied by default: a path or a tool needs an `allow` that covers it, and a `deny`
 * of the same action wins unless an `exception` takes it out. The exception does not grant by itself. `invoke` decides
 * a tool; running a command, the network and the environment are still denied.
 */
export function decide(request: PermissionRequest, policy: PermissionPolicy): PermissionEffect {
  if (request.action === 'invoke') return decideTool(request.object, policy.tool);
  if (!isPathAction(request.action)) return 'deny';
  return decidePath(request, request.action, policy.path);
}
