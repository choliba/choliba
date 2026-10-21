import { fakeChatPanel } from '../../testing';

describe('fakeChatPanel', () => {
  it('skips every question, redraws nothing, and closes when asked', async () => {
    const fake = fakeChatPanel();
    fake.panel.refresh();
    fake.panel.heading(['choliba']);
    expect(fake.headings).toEqual([['choliba']]);

    expect(await fake.panel.ask({ question: 'Nome?', options: [], multi: false })).toEqual({ status: 'skipped' });
    expect(fake.closed()).toBe(false);
    fake.panel.close();
    expect(fake.closed()).toBe(true);
  });
});
