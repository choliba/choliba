import { MIN_SECRET_LENGTH, SECRET_ENV_NAME } from './constants';
import type { LogRecord } from './record';

/**
 * Secrets never reach the log (OWASP): values under sensitive keys,
 * `NAME=value` with a sensitive NAME, and the secret values of the config's
 * envs wherever they appear in text. Done here, so it holds for any package.
 * The keys and NAMEs follow this narrower list, so a field like `passed` or
 * `author` stays in the log; the envs follow `SECRET_ENV_NAME`.
 */
const SENSITIVE =
  /api[_-]?key|access[_-]?key|private[_-]?key|secret|token|password|passwd|authorization|cookie|credential/i;
const ASSIGNMENT = /\b([A-Za-z0-9_]+)=(\S+)/g;

export const REDACTED = '[REDACTED]';

/**
 * The variables of `env` whose value is a secret: a name that matches
 * `SECRET_ENV_NAME` and a value of `minSecretLength` characters or more. The
 * log hides their values; a round's record too, so both follow one rule.
 */
export function envSecrets(
  env: Readonly<Record<string, string | undefined>>,
  minSecretLength = MIN_SECRET_LENGTH,
): (readonly [name: string, value: string])[] {
  const secrets: (readonly [string, string])[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (
      value !== undefined &&
      value.length >= minSecretLength &&
      SECRET_ENV_NAME.test(name)
    ) {
      secrets.push([name, value]);
    }
  }
  return secrets;
}

export function maskRecord(
  record: LogRecord,
  env: Readonly<Record<string, string>>,
  minSecretLength = MIN_SECRET_LENGTH,
): LogRecord {
  const secrets = envSecrets(env, minSecretLength).map(([, value]) => value);

  return {
    ...record,
    message: maskText(record.message, secrets),
    fields: maskObject(record.fields, secrets),
  };
}

function maskValue(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string') return maskText(value, secrets);
  if (Array.isArray(value))
    return value.map((item) => maskValue(item, secrets));
  if (typeof value !== 'object' || value === null) return value;
  return maskObject(value, secrets);
}

function maskObject(
  value: object,
  secrets: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      typeof nested === 'string' && SENSITIVE.test(key)
        ? REDACTED
        : maskValue(nested, secrets),
    ]),
  );
}

function maskText(text: string, secrets: readonly string[]): string {
  let masked = text.replace(ASSIGNMENT, (assignment, name: string) =>
    SENSITIVE.test(name) ? `${name}=${REDACTED}` : assignment,
  );

  for (const secret of secrets) masked = masked.replaceAll(secret, REDACTED);
  return masked;
}
