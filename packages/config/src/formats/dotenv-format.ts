import { ConfigError, type ConfigAddress, type ConfigFormat, type ConfigTree, type ConfigValue } from '../common';

/** The value of a line, without the quotes around it (no escapes inside them). */
function unquoted(value: string): string {
  const quotedWith = ['"', "'"].find((quote) => value.length >= 2 && value.startsWith(quote) && value.endsWith(quote));
  return quotedWith === undefined ? value : value.slice(1, -1);
}

/** The keys and values of a `.env` text: `KEY=value` lines; blank lines and `#` comments are skipped. */
function parseDotenv(text: string): ConfigTree {
  const tree: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const equals = trimmed.indexOf('=');
    if (trimmed === '' || trimmed.startsWith('#') || equals === -1) continue;
    tree[trimmed.slice(0, equals).trim()] = unquoted(trimmed.slice(equals + 1).trim());
  }
  return tree;
}

/** `value` as one `.env` line keeps it: a list joined by commas; quoted when a space, a `#` or a quote would change it. */
function lineValue(address: ConfigAddress, value: ConfigValue): string {
  const items = Array.isArray(value) ? value.map(String) : [String(value)];
  if (Array.isArray(value) && items.some((item) => item.includes(','))) {
    throw new ConfigError(`${address.env}: um item da lista não pode ter vírgula no .env.`);
  }
  const text = items.join(',');
  if (text.includes('\n') || (text.includes('"') && text.includes("'"))) {
    throw new ConfigError(
      `${address.env}: o .env não guarda numa linha um valor com quebra de linha ou com os dois tipos de aspas.`,
    );
  }
  if (!/[\s#"']/.test(text)) return text;
  return text.includes('"') ? `'${text}'` : `"${text}"`;
}

/**
 * `text` with the key at `address` set to `value`, the rest as it was: the line that sets it gets the new value; else a
 * commented line (`# KEY=…`) becomes it, where its explanation is; else it goes at the end.
 */
function writeDotenv(text: string, address: ConfigAddress, value: ConfigValue): string {
  const line = `${address.env}=${lineValue(address, value)}`;
  const lines = text.split('\n');
  const set = lines.findIndex((current) => current.trim().startsWith(`${address.env}=`));
  const commented = lines.findIndex((current) => new RegExp(`^#\\s*${address.env}=`).test(current.trim()));
  const at = set === -1 ? commented : set;
  if (at !== -1) return lines.map((current, index) => (index === at ? line : current)).join('\n');
  const body = text.endsWith('\n') || text === '' ? text : `${text}\n`;
  return `${body}${line}\n`;
}

/** The `.env` format: one `KEY=value` per line, read and written by the key's variable name. */
export const dotenv: ConfigFormat = {
  name: 'dotenv',
  extensions: ['.env'],
  layout: 'flat',
  parse: parseDotenv,
  write: writeDotenv,
};
