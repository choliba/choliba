import type {
  PathAction,
  PathRule,
  PermissionEffect,
  PermissionRequest,
  WriteAction,
} from './interfaces/permission-decision.interface';
import { PATH_ACTIONS, WRITE_ACTIONS } from './interfaces/permission-decision.interface';
import { withoutTrailingSlash } from './paths';
import { isWithin } from './resolve-denies';

/** Whether `path` is `root` or lies under it. A trailing slash does not change the folder. */
function covers(root: string, path: string): boolean {
  return isWithin(withoutTrailingSlash(root), withoutTrailingSlash(path));
}

function isPathAction(action: PermissionRequest['action']): action is PathAction {
  return (PATH_ACTIONS as readonly string[]).includes(action);
}

function isWriteAction(action: PathAction): action is WriteAction {
  return (WRITE_ACTIONS as readonly string[]).includes(action);
}

/** A `plan` or `ask` run keeps no write, whatever `allow` says. The caller already knows `action` is a path action. */
function writeBlocked(mode: PermissionRequest['context']['mode'], action: PathAction): boolean {
  if (mode === 'execute') return false;
  return isWriteAction(action);
}

/**
 * Whether `deny` still covers `path`. An exception of this same rule takes the path out only when the exception
 * itself lies under that deny.
 */
function denyHolds(rule: PathRule, deny: string, path: string): boolean {
  if (!covers(deny, path)) return false;
  return !rule.exception.some((exception) => covers(deny, exception) && covers(exception, path));
}

function denied(rule: PathRule, path: string): boolean {
  return rule.deny.some((deny) => denyHolds(rule, deny, path));
}

function allowed(rule: PathRule, path: string): boolean {
  return rule.allow.some((entry) => covers(entry, path));
}

/**
 * `allow` or `deny` for one request. Denied by default: a path needs an `allow` that covers it, and a `deny` of the
 * same action wins unless an `exception` takes that path out. The exception does not grant by itself.
 */
export function decide(request: PermissionRequest, policy: Readonly<Record<PathAction, PathRule>>): PermissionEffect {
  if (!isPathAction(request.action) || request.object.kind !== 'path') return 'deny';
  if (writeBlocked(request.context.mode, request.action)) return 'deny';
  const rule = policy[request.action];
  if (!allowed(rule, request.object.path)) return 'deny';
  if (denied(rule, request.object.path)) return 'deny';
  return 'allow';
}
