/** Small helpers around AbortSignal: waiting, combining, telling an abort apart. */

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export function anySignal(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal | undefined {
  const defined = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined,
  );
  return defined.length === 0 ? undefined : AbortSignal.any(defined);
}

/** Rejects as soon as the signal aborts, without waiting for the answer. */
export function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (signal === undefined) return promise;
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

export function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (
    ('name' in error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')) ||
    ('code' in error && error.code === 'ABORT_ERR')
  );
}
