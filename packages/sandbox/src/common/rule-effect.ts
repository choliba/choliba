import type { PermissionEffect, PermissionRule } from './interfaces/permission-decision.interface';

/** Whether `outer` is `inner` or holds it: a folder holds what lies under it, a server holds its tools. */
export type Covers<Entry> = (outer: Entry, inner: Entry) => boolean;

/**
 * Whether `deny` still covers `target`. An exception of this same rule takes the target out only when the exception
 * itself lies under that deny.
 */
function denyHolds<Entry>(rule: PermissionRule<Entry>, deny: Entry, target: Entry, covers: Covers<Entry>): boolean {
  if (!covers(deny, target)) return false;
  return !rule.exception.some((exception) => covers(deny, exception) && covers(exception, target));
}

/**
 * `allow` or `deny` for `target` under one rule. Denied by default: the target needs an `allow` that covers it, and a
 * `deny` wins unless an `exception` takes the target out. The exception does not grant by itself.
 */
export function ruleEffect<Entry>(rule: PermissionRule<Entry>, target: Entry, covers: Covers<Entry>): PermissionEffect {
  if (!rule.allow.some((entry) => covers(entry, target))) return 'deny';
  if (rule.deny.some((deny) => denyHolds(rule, deny, target, covers))) return 'deny';
  return 'allow';
}
