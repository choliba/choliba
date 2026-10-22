import type { ProjectSettings } from '@choliba/domain';

import type { RunningApp } from '../../app/project-app-ensure';
import { holdApp, shareApp } from '../../app/project-app-share';

/** The settings of `project`; only its name matters to sharing. */
function settings(project: string): ProjectSettings {
  return { project } as ProjectSettings;
}

/** An `ensure` that counts how many times it made the application up, and how many times it was stopped. */
function ensurer(started = true) {
  const made = { ups: 0, stops: 0 };
  const ensure = (): Promise<RunningApp> => {
    made.ups += 1;
    return Promise.resolve({
      started,
      stop: () => {
        made.stops += 1;
      },
    });
  };
  return { made, ensure };
}

describe('shareApp', () => {
  it('makes the application up once for the runs of a project, and stops it when the last one gives it back', async () => {
    const { made, ensure } = ensurer();
    const first = await shareApp(settings('a'), ensure);
    const second = await shareApp(settings('a'), ensure);

    expect([made.ups, first.started, second.started]).toEqual([1, true, true]);
    first.stop();
    first.stop();
    expect(made.stops).toBe(0);
    second.stop();
    await Promise.resolve();
    expect(made.stops).toBe(1);

    await shareApp(settings('a'), ensure);
    expect(made.ups).toBe(2);
  });

  it('keeps it up between runs while held, and stops it when let go with no run left', async () => {
    const { made, ensure } = ensurer();
    const letGo = holdApp('b');
    const run = await shareApp(settings('b'), ensure);
    run.stop();
    await Promise.resolve();
    expect(made.stops).toBe(0);

    const next = await shareApp(settings('b'), ensure);
    expect(made.ups).toBe(1);
    next.stop();
    const other = holdApp('b');
    letGo();
    letGo();
    await Promise.resolve();
    expect(made.stops).toBe(0);
    other();
    await Promise.resolve();
    expect(made.stops).toBe(1);
    holdApp('nenhum')();
  });

  it('fails every run that waited for an application that did not come up, and tries again on the next', async () => {
    let tries = 0;
    const failing = (): Promise<RunningApp> => {
      tries += 1;
      return Promise.reject(new Error('não subiu'));
    };
    await expect(shareApp(settings('c'), failing)).rejects.toThrow('não subiu');
    // Two runs waiting for the same failure: both fail, and it was tried once for them.
    const together = [shareApp(settings('c'), failing), shareApp(settings('c'), failing)];
    await expect(Promise.all(together)).rejects.toThrow('não subiu');
    await Promise.allSettled(together);
    expect(tries).toBe(2);

    const { ensure } = ensurer(false);
    const run = await shareApp(settings('c'), ensure);
    expect(run.started).toBe(false);
  });
});
