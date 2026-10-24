import { join } from 'node:path';

import { logStamp, openLogFile, textPieces, type ChatPanel, type LogFile, type PanelReply } from '@choliba/shell';

/** The first word of a suggestion's line, as it reads: the command clicked (`/projects`). */
function commandOf(line: string): string {
  const text = textPieces(line)
    .filter((piece) => piece.width > 0)
    .map((piece) => piece.text)
    .join('');
  return text.replace(/^[\s❯]+/, '').replace(/\s.*$/s, '');
}

/** A reply to a question, as the log says it. */
function replied(reply: PanelReply): string {
  if (reply.status === 'skipped') return 'pulada';
  return typeof reply.answer === 'string' ? reply.answer : reply.answer.join(', ');
}

/**
 * `panel`, keeping in `log` all that goes through it: what the person sends (`voce`) and the commands they run
 * (`comando`), what choliba answers (`choliba`) and each agent writes (under its name), every choice made (`escolha`)
 * and every question with its answer (`pergunta`, `resposta`).
 */
export function loggedPanel(panel: ChatPanel, log: LogFile): ChatPanel {
  return {
    ...panel,
    write: (text, voice) => {
      log.write(voice?.name ?? 'choliba', text);
      panel.write(text, voice);
    },
    say: (text) => {
      log.write('voce', text);
      panel.say(text);
    },
    answer: (text) => {
      log.write('choliba', text);
      panel.answer(text);
    },
    choose: async (request) => {
      const chosen = await panel.choose(request);
      const option = chosen === undefined ? undefined : request.options[chosen];
      log.write('escolha', `${request.title}: ${option?.label ?? 'cancelada'}`);
      return chosen;
    },
    ask: async (question, signal) => {
      log.write('pergunta', question.question);
      const reply = await panel.ask(question, signal);
      log.write('resposta', replied(reply));
      return reply;
    },
    onMessage: (listener) => {
      panel.onMessage((text) => {
        // What has no `/` is said, and logged there.
        if (text.startsWith('/')) log.write('comando', text);
        listener(text);
      });
    },
    suggest: (lines, onPick, hint) => {
      panel.suggest(
        lines,
        onPick === undefined
          ? undefined
          : (index) => {
              log.write('comando', commandOf(lines[index] ?? ''));
              onPick(index);
            },
        hint,
      );
    },
    clear: () => {
      log.write('choliba', 'conversa limpa');
      panel.clear();
    },
    close: () => {
      log.write('choliba', 'painel fechado');
      panel.close();
    },
  };
}

/** Opens the log of a panel session, in `<logsDirectory>/painel/<date and time>.log`, with `header` first. */
export function openPanelLog(logsDirectory: string, header: readonly string[], now: () => Date): LogFile {
  return openLogFile(join(logsDirectory, 'painel', `${logStamp(now())}.log`), header, now);
}
