import type { PanelInput, PanelKey, PanelSelect } from './interfaces/panel.interface';

/** A question for the person, asked in the panel's field: words, one of `options`, or several when `multi`. */
export interface PanelQuestion {
  readonly question: string;
  readonly options: readonly string[];
  readonly multi: boolean;
}

/** The person's answer, or `skipped` when they pressed Esc. */
export type PanelReply =
  { readonly status: 'answered'; readonly answer: string | readonly string[] } | { readonly status: 'skipped' };

/** What the panel's field does: answer the questions asked in it, one at a time, or send what is typed. */
export interface QuestionDesk {
  ask(question: PanelQuestion): Promise<PanelReply>;
  /** Called with what the person typed and sent while no question was pending. */
  onMessage(listener: (text: string) => void): void;
  /** Space marks a choice of a question of several; Esc skips the question. `true` when the key was the desk's. */
  key(key: PanelKey): boolean;
}

interface Pending {
  readonly question: PanelQuestion;
  readonly reply: (reply: PanelReply) => void;
}

/** How many choices can occupy the panel before the list scrolls inside its own area. */
const MAX_VISIBLE_OPTIONS = 8;

/** A choice as the list shows it: marked `[x]` when chosen, for a question of several. */
function choiceName(option: string, multi: boolean, marked: boolean): string {
  if (!multi) return option;
  return `${marked ? '[x]' : '[ ]'} ${option}`;
}

/**
 * The questions asked in `input`, with `select` for the choices: the field shows the question and takes the answer in
 * words, for any question; the list, shown only while a question has choices, takes one with Enter, or several marked
 * with Space, and Tab moves between the list and the field. Esc skips the question. With none pending, Enter sends what was typed, and the field shows `hint`.
 */
export function questionDesk<Styled>(input: PanelInput<Styled>, select: PanelSelect, hint: string): QuestionDesk {
  const queue: Pending[] = [];
  const messages: ((text: string) => void)[] = [];
  let marked = new Set<number>();
  /** Whether the list has the keys (a question with choices), or the field. */
  let onList = false;

  const current = (): Pending | undefined => queue[0];

  const show = (pending: Pending | undefined): void => {
    marked = new Set();
    onList = false;
    input.setText('');
    if (pending === undefined) {
      input.placeholder = hint;
      select.visible = false;
      select.blur();
      input.focus();
      return;
    }
    const { question, options, multi } = pending.question;
    input.placeholder = question;
    if (options.length === 0) {
      select.visible = false;
      select.blur();
      input.focus();
      return;
    }
    select.options = options.map((option) => ({ name: choiceName(option, multi, false), description: '' }));
    select.height = Math.min(options.length, MAX_VISIBLE_OPTIONS);
    select.visible = true;
    onList = true;
    select.focus();
  };

  const finish = (pending: Pending, reply: PanelReply): void => {
    queue.shift();
    pending.reply(reply);
    show(current());
  };

  const remark = (pending: Pending): void => {
    const { options, multi } = pending.question;
    select.options = options.map((option, index) => ({
      name: choiceName(option, multi, marked.has(index)),
      description: '',
    }));
  };

  input.onSubmit = () => {
    const text = input.plainText.trim();
    if (text === '') return;
    const pending = current();
    if (pending === undefined) {
      input.setText('');
      messages.forEach((listener) => {
        listener(text);
      });
      return;
    }
    // Words answer any question: with choices too, for the one none of them fits.
    finish(pending, { status: 'answered', answer: text });
  };

  select.on('itemSelected', () => {
    const pending = current();
    if (pending === undefined || pending.question.options.length === 0) return;
    const { options, multi } = pending.question;
    const highlighted = select.getSelectedIndex();
    const byMark = multi && marked.size > 0;
    const chosen = options.filter((_, index) => (byMark ? marked.has(index) : index === highlighted));
    if (chosen.length === 0) return;
    finish(pending, { status: 'answered', answer: multi ? chosen : chosen.join('') });
  });

  return {
    ask: (question) =>
      new Promise((reply) => {
        queue.push({ question, reply });
        if (queue.length === 1) show(current());
      }),
    onMessage: (listener) => {
      messages.push(listener);
    },
    key: (key) => {
      const pending = current();
      if (pending === undefined) return false;
      if (key.name === 'escape') {
        finish(pending, { status: 'skipped' });
        return true;
      }
      if (key.name === 'tab' && pending.question.options.length > 0) {
        onList = !onList;
        if (onList) select.focus();
        else {
          select.blur();
          input.focus();
        }
        return true;
      }
      if (key.name !== 'space' || !pending.question.multi) return false;
      const index = select.getSelectedIndex();
      if (marked.has(index)) marked.delete(index);
      else marked.add(index);
      remark(pending);
      return true;
    },
  };
}
