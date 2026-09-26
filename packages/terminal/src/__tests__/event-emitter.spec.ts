import { TypedEventEmitter } from '../event-emitter';

interface Events extends Record<string, unknown> {
  greet: string;
  count: number;
}

describe('TypedEventEmitter', () => {
  it('delivers a payload to every listener subscribed to an event', () => {
    const emitter = new TypedEventEmitter<Events>();
    const received: string[] = [];
    emitter.on('greet', (payload) => received.push(payload));
    emitter.on('greet', (payload) => received.push(payload.toUpperCase()));

    emitter.emit('greet', 'hi');

    expect(received).toEqual(['hi', 'HI']);
  });

  it('does not deliver to listeners of a different event', () => {
    const emitter = new TypedEventEmitter<Events>();
    const greetListener = jest.fn();
    const countListener = jest.fn();
    emitter.on('greet', greetListener);
    emitter.on('count', countListener);

    emitter.emit('count', 1);

    expect(countListener).toHaveBeenCalledWith(1);
    expect(greetListener).not.toHaveBeenCalled();
  });

  it('does nothing when emitting an event with no listeners', () => {
    const emitter = new TypedEventEmitter<Events>();

    expect(() => {
      emitter.emit('greet', 'hi');
    }).not.toThrow();
  });

  it('stops delivering to a listener once unsubscribed', () => {
    const emitter = new TypedEventEmitter<Events>();
    const listener = jest.fn();
    const unsubscribe = emitter.on('greet', listener);

    unsubscribe();
    emitter.emit('greet', 'hi');

    expect(listener).not.toHaveBeenCalled();
  });
});
