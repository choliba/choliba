import { UsageError } from '../common';

/** One choice of a list: what it is and how it reads. */
export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * How the assistant asks. On a terminal, the questions (`main.ts` wires `@clack/prompts`); without one, or with
 * `--no-input`, `defaultsPrompter`, which takes the defaults and fails naming the flag when there is none.
 */
export interface Prompter {
  text(question: string, flag: string, fallback?: string): Promise<string>;
  select<T extends string>(question: string, choices: readonly Choice<T>[], fallback: T): Promise<T>;
  multiselect<T extends string>(question: string, choices: readonly Choice<T>[], fallback: readonly T[]): Promise<T[]>;
}

/** No questions: the default of each, or a failure naming the flag that gives the value. */
export const defaultsPrompter: Prompter = {
  text: (question, flag, fallback) => {
    if (fallback !== undefined) return Promise.resolve(fallback);
    return Promise.reject(new UsageError(`sem perguntas, ${flag} é obrigatório (${question}).`));
  },
  select: (_question, _choices, fallback) => Promise.resolve(fallback),
  multiselect: (_question, _choices, fallback) => Promise.resolve([...fallback]),
};
