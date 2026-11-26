export class UsageError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UsageError';
  }
}

/**
 * A `UsageError` for the first key of `options` that `known` lacks: an option
 * nobody reads is refused, never ignored (a misspelled one would do nothing
 * and say nothing). `where` names whose options they are (`no Agent`).
 */
export function rejectUnknownOptions(
  options: object,
  known: Readonly<Record<string, true>>,
  where: string,
): void {
  const unknown = Object.keys(options).find(
    (key) => !Object.hasOwn(known, key),
  );
  if (unknown === undefined) return;
  throw new UsageError(
    `Opção desconhecida "${unknown}" ${where}. Opções: ${Object.keys(known).join(', ')}.`,
  );
}
