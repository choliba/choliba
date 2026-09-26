import type { Writable } from '@choliba/terminal';

import { loadAgent } from '../agent-loader';

export { type ValidationResult, validateAgentFiles, validateAgentYaml, validateSystemMd } from '../agent-validation';

const SECTION_TAG = /<([a-z][a-z0-9_]*)((?:\s+[a-z][a-z0-9_]*="[^"]*")*)\s*>([\s\S]*?)<\/\1>/g;
const ATTRIBUTE = /([a-z][a-z0-9_]*)="([^"]*)"/g;

export interface SectionTagMatch {
  readonly tagName: string;
  readonly rawAttributes: string;
  readonly inner: string;
}

/** Pulls capture groups out of one `SECTION_TAG` match; returns `undefined` when incomplete. */
export function parseSectionTagMatch(match: RegExpMatchArray): SectionTagMatch | undefined {
  const tagName = match[1];
  const rawAttributes = match[2];
  const inner = match[3];
  if (tagName === undefined || rawAttributes === undefined || inner === undefined) {
    return undefined;
  }
  return { tagName, rawAttributes, inner };
}

/** Pulls one `name="value"` pair out of an attribute regex match. */
export function parseAttributePair(match: RegExpMatchArray): { readonly key: string; readonly value: string } | undefined {
  const key = match[1];
  const value = match[2];
  if (key === undefined || value === undefined) {
    return undefined;
  }
  return { key, value };
}

/** Adds one attribute regex match into `target` when capture groups are complete. */
export function collectAttributeFromMatch(match: RegExpMatchArray, target: Record<string, string>): boolean {
  const pair = parseAttributePair(match);
  if (pair === undefined) {
    return false;
  }
  target[pair.key] = pair.value;
  return true;
}

/** Parses a tag's raw attribute string (e.g. ` action="write" mode="strict"`) into a plain object. */
export function parseAttributes(raw: string): Record<string, string> | undefined {
  if (raw.trim() === '') return undefined;
  const attributes: Record<string, string> = {};
  for (const match of raw.matchAll(ATTRIBUTE)) {
    collectAttributeFromMatch(match, attributes);
  }
  return attributes;
}

function buildSectionValue(
  rawAttributes: string,
  inner: string,
): string | Record<string, unknown> {
  const attributes = parseAttributes(rawAttributes);
  const parsedInner = parseInstructionSections(inner);
  if (attributes === undefined) {
    return parsedInner;
  }
  if (typeof parsedInner === 'string') {
    return { '@attributes': attributes, '@text': parsedInner };
  }
  return { '@attributes': attributes, ...parsedInner };
}

/** Merges one section-tag regex match into `grouped` when capture groups are complete. */
export function collectSectionFromMatch(match: RegExpMatchArray, grouped: Map<string, unknown[]>): boolean {
  const groups = parseSectionTagMatch(match);
  if (groups === undefined) {
    return false;
  }
  const { tagName, rawAttributes, inner } = groups;
  const values = grouped.get(tagName) ?? [];
  values.push(buildSectionValue(rawAttributes, inner));
  grouped.set(tagName, values);
  return true;
}

/**
 * Parses `system.md`'s XML-tag sections into nested JSON: a tag with no nested tags becomes its
 * trimmed text; a tag containing further tags becomes an object of its children, recursively.
 * Sibling tags that repeat the same name become an array, in document order — the convention a
 * pluralized tag name (`<notes>`, `<tool_definitions>`) should follow when it holds more than
 * one distinct item, instead of merging them into one blob. A name used only once stays a plain
 * value, even if pluralized. A tag's attributes (e.g. `<allow action="write">`) land under an
 * `"@attributes"` key alongside its normal value — merged alongside nested children, or paired
 * with `"@text"` when the tag has none. Relies on `system.md` never mixing loose prose alongside
 * nested tags — content outside a matched tag is silently dropped, so every agent's `system.md`
 * must wrap all of its content in tags, not just some of it (see any well-formed agent system.md).
 */
export function parseInstructionSections(text: string): string | Record<string, unknown> {
  const matches = [...text.matchAll(SECTION_TAG)];
  if (matches.length === 0) {
    return text.trim();
  }

  const grouped = new Map<string, unknown[]>();
  for (const match of matches) {
    collectSectionFromMatch(match, grouped);
  }

  const sections: Record<string, unknown> = {};
  for (const [tagName, values] of grouped) {
    sections[tagName] = values.length === 1 ? values[0] : values;
  }
  return sections;
}

/**
 * `system.md` must be well-formed XML (see `validateSystemMd`), which means exactly one root
 * tag wrapping the whole document — by convention, `<agent>`. `parseInstructionSections` has no
 * notion of a root, so it returns that wrapper as a single `"agent"` key; this drops it, so
 * `instructions` in the printed JSON keeps the same flat, section-per-key shape it always had.
 * A parse with no `"agent"` key (e.g. a fixture with no root) is returned untouched.
 */
/** Drops the conventional `<agent>` wrapper from parsed `system.md` JSON — see `printAgentDefinition`. */
export function unwrapAgentRoot(parsed: string | Record<string, unknown>): string | Record<string, unknown> {
  if (typeof parsed === 'string') return parsed;
  const root = parsed['agent'];
  if (root === undefined) return parsed;
  return root as string | Record<string, unknown>;
}

/**
 * Reads one agent's `agent.yaml` + `system.md` (via `loadAgent`, which now also validates both
 * files for real — see `agent-validation.ts` — and requires `name` to be a valid, loadable agent
 * under `agentsDir`; empty, unknown or invalid agents throw `AgentConfigError` there) and writes
 * it as JSON: `agent.yaml`'s own fields first (the canonical metadata), then path info, then
 * `instructions` nested via `parseInstructionSections` (and unwrapped from its `<agent>` root —
 * see `unwrapAgentRoot`). First step towards tooling that inspects an agent's definition without
 * invoking it.
 */
export async function printAgentDefinition(agentsDir: string, name: string, stdout: Writable): Promise<void> {
  const agent = await loadAgent(agentsDir, name);
  const json = {
    id: agent.id,
    name: agent.name,
    displayName: agent.displayName,
    version: agent.version,
    description: agent.description,
    supportedModels: agent.supportedModels,
    skills: agent.skills,
    mcps: agent.mcps,
    dir: agent.dir,
    systemPromptPath: agent.systemPromptPath,
    instructions: unwrapAgentRoot(parseInstructionSections(agent.instructions)),
  };
  stdout.write(`${JSON.stringify(json, null, 2)}\n`);
}
