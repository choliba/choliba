import type { ProgramCommand } from '../../execute/types';
import { UsageError } from '../../errors';
import {
  isWithin,
  join,
  pathExists,
  realPath,
  resolve,
} from '../../filesystem/index';
import { AGENT_ROOT, HOST_HOMES, SANDBOX_SUPPORT_DIR } from '../constants';
import { findInPath } from './programs';

export interface SandboxPathsOptions {
  /** The workspace root, on the host. */
  readonly root: string;
  /** Where the root is seen in the sandbox; `AGENT_ROOT` by default. */
  readonly agentRoot?: string;
  /** The workspace's home (the CLI's), on the host. */
  readonly home?: string;
  /** The host user's home. */
  readonly hostHome: string;
}

/** A host directory and where the sandbox sees it. */
interface PathRule {
  readonly host: string;
  readonly inside: string;
}

/** `/home/<name>`: the only thing in the sandbox's `/home`. */
const AGENT_ROOT_SHAPE = /^\/home\/[^/]+$/;

/**
 * Where each host path is seen inside a sandbox: the workspace root at
 * `agentRoot`, and whatever else lives under the host's `/home` (the CLI's
 * home, the tools in the user's home, Choliba's cache) under
 * `SANDBOX_SUPPORT_DIR`, so that `/home` holds nothing of the host. Paths
 * outside `/home` (`/usr`, `/etc`, `/tmp`…) are seen where they are.
 */
export class SandboxPaths {
  public readonly agentRoot: string;
  private readonly options: SandboxPathsOptions;
  private readonly rules: readonly PathRule[];

  public constructor(options: SandboxPathsOptions) {
    const { root, agentRoot = AGENT_ROOT, home, hostHome } = options;
    this.options = options;
    if (!AGENT_ROOT_SHAPE.test(agentRoot)) {
      throw new UsageError(
        `agentRoot deve ser uma pasta direto em /home, como ${AGENT_ROOT}: ${agentRoot}`,
      );
    }
    this.agentRoot = agentRoot;
    // On a tie (the same host path twice), the first one wins: the root.
    this.rules = [
      { host: resolve(root), inside: agentRoot },
      ...(home === undefined
        ? []
        : [{ host: resolve(home), inside: join(SANDBOX_SUPPORT_DIR, 'home') }]),
      { host: resolve(hostHome), inside: join(SANDBOX_SUPPORT_DIR, 'user') },
      { host: HOST_HOMES, inside: join(SANDBOX_SUPPORT_DIR, 'host') },
    ].filter((rule) => rule.host !== '/');
  }

  /** The same, with `home` as the workspace's home (the CLI's). */
  public withHome(home: string): SandboxPaths {
    return new SandboxPaths({ ...this.options, home });
  }

  /** Where the sandbox sees the host path `path`. */
  public inside(path: string): string {
    const absolute = resolve(path);
    const rule = this.ruleFor(absolute);
    if (rule === undefined) return absolute;
    return `${rule.inside}${absolute.slice(rule.host.length)}`;
  }

  /** Whether the sandbox sees `path` somewhere else than on the host. */
  public moves(path: string): boolean {
    return this.ruleFor(resolve(path)) !== undefined;
  }

  /**
   * A value handed to the sandbox (an argument, a variable) with each host
   * path in it translated: the whole value, each `:`-separated entry
   * (`PATH`) and what follows `name=` (`--option=/path`, `VAR=/path`).
   * Text that is not a path stays as it is.
   */
  public insideValue(value: string): string {
    const separator = value.indexOf('=');
    if (separator > 0 && !value.startsWith('/')) {
      return `${value.slice(0, separator + 1)}${this.insideList(value.slice(separator + 1))}`;
    }
    return this.insideList(value);
  }

  /** Each value of `env`, translated (see `insideValue`). */
  public insideEnv(
    env: Readonly<Record<string, string | undefined>>,
  ): Record<string, string> {
    const translated: Record<string, string> = {};
    for (const [name, value] of Object.entries(env)) {
      if (value !== undefined) translated[name] = this.insideList(value);
    }
    return translated;
  }

  /**
   * `command` as the sandbox runs it: its arguments translated and its
   * executable, when it lives in a path that moves, by its real path (a
   * link in `~/.local/bin` points to the host's `/home`, which the sandbox
   * does not have). `searchPath` is the host's `PATH`.
   */
  public insideCommand(
    command: ProgramCommand,
    searchPath: string | undefined,
  ): ProgramCommand {
    const args = command.arguments ?? [];
    const program =
      command.executable === 'env' ? programAfterEnv(args) : undefined;
    return {
      ...command,
      executable: this.insideExecutable(command.executable, searchPath),
      arguments: args.map((argument, index) =>
        index === program
          ? this.insideExecutable(argument, searchPath)
          : this.insideValue(argument),
      ),
    };
  }

  private insideExecutable(
    executable: string,
    searchPath: string | undefined,
  ): string {
    const found = executable.includes('/')
      ? executable
      : findInPath(executable, searchPath);
    if (found === undefined || !pathExists(found)) return executable;
    const real = realPath(found);
    return this.moves(real) ? this.inside(real) : executable;
  }

  private insideList(value: string): string {
    return value
      .split(':')
      .map((entry) =>
        entry.startsWith('/') && this.moves(entry) ? this.inside(entry) : entry,
      )
      .join(':');
  }

  /** The most specific rule that holds `path`. */
  private ruleFor(path: string): PathRule | undefined {
    let best: PathRule | undefined;
    for (const rule of this.rules) {
      if (!isWithin(path, rule.host)) continue;
      if (best === undefined || rule.host.length > best.host.length) {
        best = rule;
      }
    }
    return best;
  }
}

/**
 * `env NAME=value… [env NAME=value…] program`: where the program is in
 * `args` (the `env` executable's), the one that counts.
 */
function programAfterEnv(args: readonly string[]): number | undefined {
  const index = args.findIndex(
    (argument) => !argument.includes('=') && argument !== 'env',
  );
  return index < 0 ? undefined : index;
}
