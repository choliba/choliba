import { rawArgsAfter, takeGlobalFlags } from '../../platform';

describe('rawArgsAfter', () => {
  it('drops the command path that chose them, keeping everything else as typed', () => {
    expect(rawArgsAfter(['projects', 'create-project', 'x', '--app-dir', 'a'], 'projects', 'create-project')).toEqual([
      'x',
      '--app-dir',
      'a',
    ]);
    expect(rawArgsAfter(['projects', '--help'], 'projects', 'create-project')).toEqual(['--help']);
    expect(rawArgsAfter(['tests', '--x', '--', 'y'], 'tests')).toEqual(['--x', '--', 'y']);
    expect(rawArgsAfter(['product-owner', '--dry-run'], 'agents')).toEqual(['product-owner', '--dry-run']);
  });
});

describe('takeGlobalFlags', () => {
  it('takes --no-color out wherever it is before --, and leaves what follows -- alone', () => {
    expect(takeGlobalFlags(['--no-color', 'agents', 'x', '--no-color'])).toEqual({
      argv: ['agents', 'x'],
      noColorFlag: true,
    });
    expect(takeGlobalFlags(['terminal', 'run', '--label', 'a', '--', 'tool', '--no-color'])).toEqual({
      argv: ['terminal', 'run', '--label', 'a', '--', 'tool', '--no-color'],
      noColorFlag: false,
    });
    expect(takeGlobalFlags([])).toEqual({ argv: [], noColorFlag: false });
  });
});
