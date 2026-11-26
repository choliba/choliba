/**
 * Async sequences for executions: `OutputStream`, a queue read with
 * `for await`, and `OutputDispatcher`, which keeps one stream per execution.
 * Following them all is for events (`src/events`), the one bus.
 */

interface OutputQueue<T> {
  push(value: T): void;
  close(): void;
  fail(error: Error): void;
  read(): AsyncIterable<T>;
}

export class OutputStream<T> implements AsyncIterable<T> {
  private readonly queue = createQueue<T>();

  public publish(value: T): void {
    this.queue.push(value);
  }

  public close(): void {
    this.queue.close();
  }

  public fail(error: Error): void {
    this.queue.fail(error);
  }

  public [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.queue.read()[Symbol.asyncIterator]();
  }
}

interface Execution<T> {
  readonly programId: string;
  readonly queue: OutputQueue<T>;
}

export class OutputDispatcher<T> {
  private readonly executions = new Map<string, Execution<T>>();

  public open(executionId: string, programId: string): AsyncIterable<T> {
    if (this.executions.has(executionId)) {
      throw new Error(`A execução ${executionId} já existe.`);
    }

    const queue = createQueue<T>();
    this.executions.set(executionId, { programId, queue });
    return queue.read();
  }

  public publish(executionId: string, programId: string, value: T): void {
    this.getExecution(executionId, programId).queue.push(value);
  }

  public close(executionId: string, programId: string): void {
    const execution = this.getExecution(executionId, programId);
    this.executions.delete(executionId);
    execution.queue.close();
  }

  public fail(executionId: string, programId: string, error: Error): void {
    const execution = this.getExecution(executionId, programId);
    this.executions.delete(executionId);
    execution.queue.fail(error);
  }

  private getExecution(executionId: string, programId: string): Execution<T> {
    const execution = this.executions.get(executionId);

    if (execution === undefined) {
      throw new Error(`A execução ${executionId} não está aberta.`);
    }

    if (execution.programId !== programId) {
      throw new Error(`A execução ${executionId} não pertence a ${programId}.`);
    }

    return execution;
  }
}

function createQueue<T>(): OutputQueue<T> {
  // Boxed so a queued `undefined` is not mistaken for an empty queue.
  const values: { readonly value: T }[] = [];
  let ended = false;
  let failure: Error | undefined;
  let waiting: (() => void) | undefined;

  const wake = (): void => {
    const resolve = waiting;
    waiting = undefined;
    resolve?.();
  };

  return {
    push(value): void {
      if (!ended) {
        values.push({ value });
        wake();
      }
    },
    close(): void {
      if (!ended) {
        ended = true;
        wake();
      }
    },
    fail(error): void {
      if (!ended) {
        ended = true;
        failure = error;
        wake();
      }
    },
    async *read(): AsyncGenerator<T> {
      for (;;) {
        const next = values.shift();

        if (next !== undefined) {
          yield next.value;
        } else if (ended) {
          break;
        } else {
          await new Promise<void>((resolve) => {
            waiting = resolve;
          });
        }
      }

      if (failure !== undefined) {
        throw failure;
      }
    },
  };
}
