import type { ConfigService } from '../config';
import type { Environment, WritableWithColumns } from '../platform';
import type { AnsiColor } from './ansi';
import type { Theme, ThemeRole } from './interfaces/theme.interface';
import { resolveTheme } from './resolve-theme';

/**
 * The one place that decides whether choliba colors its output and with which colors. Read once, on first
 * use, so a command that never paints never reads the workspace's `.env`. A plain class: the shell builds it, and
 * `ThemeModule` gives it to the commands still on Nest.
 */
export class ThemeService {
  private resolved: Theme | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly env: Environment,
    private readonly stdout: WritableWithColumns,
    private readonly noColorFlag: boolean,
  ) {}

  /** The theme itself, for code that takes a `Theme` (decided once, like everything here). */
  theme(): Theme {
    this.resolved ??= this.resolve();
    return this.resolved;
  }

  enabled(): boolean {
    return this.theme().enabled;
  }

  paint(role: ThemeRole, name: string, text: string, declared?: AnsiColor): string {
    return this.theme().paint(role, name, text, declared);
  }

  colorOf(role: ThemeRole, name: string, declared?: AnsiColor): AnsiColor {
    return this.theme().colorOf(role, name, declared);
  }

  /** `CHOL_COLORS` of the workspace (or of the environment, outside one), on or off per the flag and stdout. */
  private resolve(): Theme {
    const root = this.config.workspaceRootOrNothing();
    return resolveTheme(root === undefined ? this.env : this.config.load(root), {
      env: this.env,
      isTTY: this.stdout.isTTY === true,
      noColorFlag: this.noColorFlag,
    });
  }
}
