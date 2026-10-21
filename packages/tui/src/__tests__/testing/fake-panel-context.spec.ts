import { fakePanelContext } from '../../testing';

describe('fakePanelContext', () => {
  it('asks what runs to stop on quit, and says it was asked to quit', async () => {
    const fake = fakePanelContext();
    let stopped = 0;
    fake.context.busy(() => {
      stopped += 1;
    });

    expect(fake.quitted()).toBe(false);
    await fake.context.quit();
    expect([stopped, fake.quitted()]).toEqual([1, true]);
  });
});
