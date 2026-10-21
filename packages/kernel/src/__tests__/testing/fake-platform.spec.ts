import { BufferWritable, FAKE_NOW, fakePlatform, FakeSignals } from '../../testing';

describe('fakePlatform', () => {
  it('starts with nothing: no arguments, no environment, a fixed clock and no executables', () => {
    const platform = fakePlatform();

    expect(platform.argv).toEqual([]);
    expect(platform.env).toEqual({});
    expect(platform.clock()).toBe(FAKE_NOW);
    expect(platform.which('git')).toBeNull();
    expect(platform.noColorFlag).toBe(false);
  });

  it('fails loudly when a spec runs a process or git it did not set up', () => {
    const platform = fakePlatform();

    expect(() => platform.spawn.spawn({ command: ['ls', '-l'] })).toThrow('não esperava rodar ls -l');
    expect(platform.git.run(['status'], '/r')).toEqual({
      stdout: '',
      stderr: 'este spec não esperava rodar git status',
      status: 1,
    });
  });

  it('takes what the spec passes', () => {
    expect(fakePlatform({ cwd: '/w', argv: ['x'] })).toMatchObject({ cwd: '/w', argv: ['x'] });
  });
});

describe('BufferWritable', () => {
  it('keeps what was written and says whether it is a terminal', () => {
    const out = new BufferWritable(true);
    out.write('a');
    out.write('b');

    expect(out.chunks).toEqual(['a', 'b']);
    expect(out.text()).toBe('ab');
    expect(out.isTTY).toBe(true);
    expect(new BufferWritable().isTTY).toBe(false);
  });
});

describe('FakeSignals', () => {
  it('calls the listeners of a signal until they are removed', () => {
    const signals = new FakeSignals();
    const listener = jest.fn();
    signals.on('SIGINT', listener);
    signals.on('SIGINT', listener);

    signals.emit('SIGINT');
    signals.emit('SIGTERM');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(signals.count('SIGINT')).toBe(1);

    signals.off('SIGINT', listener);
    signals.off('SIGTERM', listener);
    signals.emit('SIGINT');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(signals.count('SIGINT')).toBe(0);
    expect(signals.count('SIGTERM')).toBe(0);
  });
});
