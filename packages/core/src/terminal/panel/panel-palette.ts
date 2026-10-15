import type { AnsiColor } from '../../theme';

/**
 * The 16 colors as the panel paints them. A terminal paints its own palette; the panel draws its cells itself, so it
 * picks one: the default dark palette of the most common editor terminal.
 */
export const PALETTE: Readonly<Record<AnsiColor, string>> = {
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  gray: '#666666',
  'bright-red': '#f14c4c',
  'bright-green': '#23d18b',
  'bright-yellow': '#f5f543',
  'bright-blue': '#3b8eea',
  'bright-magenta': '#d670d6',
  'bright-cyan': '#29b8db',
};
