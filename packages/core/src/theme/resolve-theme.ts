import { CHOL_COLORS } from '../config';
import { ANSI_COLORS, colorForLabel, isAnsiColor, paintAnsi, type AnsiColor } from './ansi';
import type { ColorSettings, Theme, ThemeRole, ThemeTable } from './interfaces/theme.interface';
import { DEFAULT_THEME, THEME_ROLES } from './theme-defaults';

/** What a workspace chose: only the roles and names `CHOL_COLORS` lists. */
export type ThemeChoices = Partial<Record<ThemeRole, Readonly<Record<string, AnsiColor>>>>;

/** A `CHOL_COLORS` that is not a list of `papel.nome=cor`; the message says which item and how to write it. */
export class ColorsConfigError extends Error {}

function isRole(value: string): value is ThemeRole {
  return THEME_ROLES.some((role) => role === value);
}

interface ColorChoice {
  readonly role: ThemeRole;
  readonly name: string;
  readonly color: AnsiColor;
}

/** One `papel.nome=cor` of `CHOL_COLORS`. */
function parseChoice(item: string): ColorChoice {
  const match = /^([^.=\s]+)\.([^=\s]+)\s*=\s*(\S+)$/.exec(item);
  const [, role = '', name = '', color = ''] = match ?? [];
  if (match === null) {
    throw new ColorsConfigError(
      `${CHOL_COLORS}: "${item}" deve ser papel.nome=cor (ex.: agents.test-writer=red), separados por vírgula.`,
    );
  }
  if (!isRole(role)) {
    throw new ColorsConfigError(`${CHOL_COLORS}: "${role}" não é um papel. Use: ${THEME_ROLES.join(', ')}.`);
  }
  if (!isAnsiColor(color)) {
    throw new ColorsConfigError(
      `${CHOL_COLORS}: ${role}.${name}=${color} não é uma cor. Use uma destas: ${ANSI_COLORS.join(', ')}.`,
    );
  }
  return { role, name, color };
}

/**
 * The choices in `CHOL_COLORS` (`agents.test-writer=red,states.error=bright-red`); none when it is unset or
 * blank. Throws `ColorsConfigError` naming the variable and the item.
 */
export function parseColors(value: string | undefined): ThemeChoices {
  const choices: Partial<Record<ThemeRole, Record<string, AnsiColor>>> = {};
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  for (const { role, name, color } of items.map(parseChoice)) {
    choices[role] = { ...choices[role], [name]: color };
  }
  return choices;
}

function isSet(value: string | undefined): boolean {
  return value !== undefined && value !== '';
}

/**
 * Color is for people at a terminal: off with `--no-color`, a non-empty `NO_COLOR`, `FORCE_COLOR=0` or
 * `TERM=dumb`, and when stdout is not a terminal; any other non-empty `FORCE_COLOR` turns it on even in a pipe.
 */
export function colorEnabled(settings: ColorSettings): boolean {
  const force = settings.env['FORCE_COLOR'];
  if (settings.noColorFlag || isSet(settings.env['NO_COLOR']) || force === '0') {
    return false;
  }
  if (isSet(force)) {
    return true;
  }
  return settings.env['TERM'] !== 'dumb' && settings.isTTY;
}

/** A theme from the choices of a workspace over the defaults (see `Theme.paint` for the order). */
export function buildTheme(choices: ThemeChoices, enabled: boolean, defaults: ThemeTable = DEFAULT_THEME): Theme {
  const colorOf = (role: ThemeRole, name: string, declared?: AnsiColor): AnsiColor =>
    choices[role]?.[name] ?? declared ?? defaults[role][name] ?? colorForLabel(name);
  return {
    enabled,
    colorOf,
    paint: (role, name, text, declared) => (enabled ? paintAnsi(colorOf(role, name, declared), text) : text),
  };
}

/**
 * The theme of a workspace: `CHOL_COLORS` of its configuration (the `.env`, with the process environment on
 * top) over the defaults, with color on or off per `settings`. Also for code outside a command, like the
 * Playwright reporter.
 */
export function resolveTheme(config: Readonly<Record<string, string | undefined>>, settings: ColorSettings): Theme {
  return buildTheme(parseColors(config[CHOL_COLORS]), colorEnabled(settings));
}
