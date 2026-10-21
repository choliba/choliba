import type { AnsiColor } from '../ansi';

/** What a color is chosen for: whose name it paints. */
export type ThemeRole = 'providers' | 'agents' | 'states' | 'gates' | 'labels';

/** Colors by role, then by name (`agents: { implementer: green }`). */
export type ThemeTable = Readonly<Record<ThemeRole, Readonly<Record<string, AnsiColor>>>>;

/** Whether color is on, decided once from the flag, the environment and the terminal. */
export interface ColorSettings {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly isTTY: boolean;
  readonly noColorFlag: boolean;
}

export interface Theme {
  readonly enabled: boolean;
  /**
   * `text` in the color of `name` in `role`: `CHOL_COLORS` first, then the color its own file declares
   * (`declared`, an agent's `agent.color`), then the default, then a color derived from the name. Plain text
   * when color is off.
   */
  paint(role: ThemeRole, name: string, text: string, declared?: AnsiColor): string;
  /** The color `paint` uses, whether or not color is on (for code that colors on its own, like `formatLine`). */
  colorOf(role: ThemeRole, name: string, declared?: AnsiColor): AnsiColor;
}
