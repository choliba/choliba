/**
 * `text` (a `.env`) with `key` set to `value`: the line that sets it, or the commented one the template brings
 * (`# CHOL_AGENTS_PROVIDER=auto`), becomes `key=value`; without either, the line goes at the end.
 */
export function setEnvValue(text: string, key: string, value: string): string {
  const line = new RegExp(`^#?\\s*${key}=.*$`, 'm');
  if (line.test(text)) return text.replace(line, `${key}=${value}`);
  const before = text === '' ? '' : text.replace(/\n*$/, '\n');
  return `${before}${key}=${value}\n`;
}
