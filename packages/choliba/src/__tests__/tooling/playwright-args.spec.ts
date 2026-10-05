import { join } from 'node:path';

import { DEFAULT_OUTPUT_DIR, intoOutputDir } from '../../tooling/playwright-args';

describe('intoOutputDir', () => {
  it('moves a relative --filename, in both forms, into the output folder', () => {
    expect(intoOutputDir(['screenshot', '--filename=home.png'], '.cache/pw')).toEqual([
      'screenshot',
      `--filename=${join('.cache/pw', 'home.png')}`,
    ]);
    expect(intoOutputDir(['snapshot', '--filename', 'tela/login.yml', 'e5'], '.cache/pw')).toEqual([
      'snapshot',
      '--filename',
      join('.cache/pw', 'tela/login.yml'),
      'e5',
    ]);
  });

  it('keeps an absolute --filename, the other arguments and a --filename with no value as they are', () => {
    expect(intoOutputDir(['screenshot', '--filename=/tmp/a.png'], '.cache/pw')).toEqual([
      'screenshot',
      '--filename=/tmp/a.png',
    ]);
    expect(intoOutputDir(['open', 'http://x', '--headed'], '.cache/pw')).toEqual(['open', 'http://x', '--headed']);
    expect(intoOutputDir(['screenshot', '--filename'], '.cache/pw')).toEqual(['screenshot', '--filename']);
  });

  it('uses the folder the browser writes its own files to when none is configured', () => {
    expect(DEFAULT_OUTPUT_DIR).toBe('.cache/playwright-cli');
  });
});
