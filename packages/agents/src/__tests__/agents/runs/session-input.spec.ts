import { ALREADY_DONE, NOT_READ, sessionInput } from '../../../agents/runs/session-input';

function fakeSession(accepts = true) {
  const written: string[] = [];
  const ended: boolean[] = [];
  return {
    written,
    ended,
    session: {
      write: (text: string): boolean => {
        if (!accepts || ended.length > 0) return false;
        written.push(text);
        return true;
      },
      endInput: (): void => {
        ended.push(true);
      },
    },
  };
}

const asLine = (text: string): string => `<${text}>`;

describe('sessionInput', () => {
  it('sends the task, then each message, and closes stdin once no turn is left in flight', () => {
    const fake = fakeSession();
    const input = sessionInput(fake.session, asLine, 'tarefa');

    input.begin();
    expect(input.send('use React')).toBeUndefined();
    input.turnEnded();
    expect(fake.ended).toEqual([]);
    input.turnEnded();
    expect(fake.ended).toEqual([true]);
    expect(fake.written).toEqual(['<tarefa>', '<use React>']);
    expect(input.send('tarde demais')).toBe(ALREADY_DONE);
  });

  it('says a provider that reads nothing gets no message, and never closes what it never opened', () => {
    const fake = fakeSession();
    const input = sessionInput(fake.session, undefined, 'tarefa');

    input.begin();
    expect(input.send('olá')).toBe(NOT_READ);
    input.turnEnded();
    expect(fake.written).toEqual([]);
    expect(fake.ended).toEqual([]);
  });

  it('closes stdin when a guard stops the session, and counts no turn below zero', () => {
    const fake = fakeSession(false);
    const input = sessionInput(fake.session, asLine, 'tarefa');

    input.begin();
    input.turnEnded();
    expect(fake.ended).toEqual([true]);
    input.close();
    expect(fake.ended).toEqual([true, true]);
  });
});
