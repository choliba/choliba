/**
 * What an agent's `system.md` declares in `<permissions>`, read so the providers can enforce it
 * instead of only asking the model to follow it. The XML was already validated against
 * `schemes/agent.xsd` when the agent loaded, so plain pattern matching is enough here.
 */
export interface AgentPermissions {
  /** Provider tools the agent may use to read (`<allow action="read"><tool>`), e.g. `Read`. */
  readonly allowTools: readonly string[];
  /** Paths the agent may read (`read`/`all` groups), in the form written in system.md. */
  readonly allowRead: readonly string[];
  /** Paths the agent may write (`write`/`all` groups). */
  readonly allowWrite: readonly string[];
  /** Command prefixes the agent may run (`<allow action="run"><command>`), e.g. `git diff`. */
  readonly allowRun: readonly string[];
  readonly denyRead: readonly string[];
  readonly denyWrite: readonly string[];
  readonly denyRun: readonly string[];
}

const EMPTY: AgentPermissions = {
  allowTools: [],
  allowRead: [],
  allowWrite: [],
  allowRun: [],
  denyRead: [],
  denyWrite: [],
  denyRun: [],
};

function decode(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .trim();
}

/**
 * Every match of `pattern`, as the list of its capture groups. `replaceAll`'s callback receives the
 * groups followed by the offset and the whole input, hence the last two are dropped.
 */
function captures(text: string, pattern: RegExp): string[][] {
  const found: string[][] = [];
  text.replaceAll(pattern, (_whole: string, ...args: unknown[]) => {
    found.push(args.slice(0, -2).map(String));
    return '';
  });
  return found;
}

function children(body: string, tag: string): string[] {
  return captures(body, new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')).map(([inner]) =>
    decode(String(inner)),
  );
}

interface Group {
  readonly action: string;
  readonly paths: readonly string[];
  readonly commands: readonly string[];
  readonly tools: readonly string[];
}

function groups(section: string, tag: 'allow' | 'deny'): Group[] {
  return captures(section, new RegExp(`<${tag}\\s+action="([a-z]+)"\\s*>([\\s\\S]*?)</${tag}>`, 'g')).map(
    ([action, body]) => ({
      action: String(action),
      paths: children(String(body), 'path'),
      commands: children(String(body), 'command'),
      tools: children(String(body), 'tool'),
    }),
  );
}

function collect(list: readonly Group[], actions: readonly string[], pick: (group: Group) => readonly string[]) {
  return list.filter((group) => actions.includes(group.action)).flatMap(pick);
}

/** Reads `<permissions>` from a system.md; an agent that declares none gets empty lists. */
export function readAgentPermissions(instructions: string): AgentPermissions {
  const section = /<permissions>([\s\S]*?)<\/permissions>/.exec(instructions)?.[1];
  if (section === undefined) {
    return EMPTY;
  }
  const allow = groups(section, 'allow');
  const deny = groups(section, 'deny');
  return {
    allowTools: collect(allow, ['read'], (group) => group.tools),
    allowRead: collect(allow, ['read', 'all'], (group) => group.paths),
    allowWrite: collect(allow, ['write', 'all'], (group) => group.paths),
    allowRun: collect(allow, ['run'], (group) => group.commands),
    denyRead: collect(deny, ['read', 'all'], (group) => group.paths),
    denyWrite: collect(deny, ['write', 'all'], (group) => group.paths),
    denyRun: collect(deny, ['run'], (group) => group.commands),
  };
}

/** A declared path as a glob: `docs/` covers everything under it, anything else stays as written. */
export function pathGlob(path: string): string {
  return path.endsWith('/') ? `${path}**` : path;
}
