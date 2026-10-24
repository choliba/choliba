import { spawnToEnd } from '../../steps/step-spawn';

describe('spawnToEnd', () => {
  it("resolves to the command's exit status", async () => {
    expect(await spawnToEnd('true', [], { stdio: 'ignore' })).toEqual({ status: 0 });
    expect(await spawnToEnd('sh', ['-c', 'exit 3'], { stdio: 'ignore' })).toEqual({ status: 3 });
  });

  it('has no status for a command that does not start, or that the signal stops', async () => {
    expect(await spawnToEnd('no-such-command-choliba', [], { stdio: 'ignore' })).toEqual({ status: null });

    const stop = new AbortController();
    const running = spawnToEnd('sleep', ['5'], { stdio: 'ignore', signal: stop.signal });
    stop.abort();
    expect(await running).toEqual({ status: null });
  });

  it('leaves the process free while the command runs: a timer fires before it ends', async () => {
    const order: string[] = [];
    const running = spawnToEnd('sleep', ['0.3'], { stdio: 'ignore' }).then(() => order.push('comando'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    order.push('timer');
    await running;

    expect(order).toEqual(['timer', 'comando']);
  });
});
