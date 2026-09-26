import { parseRunArgs } from '../../cli/args';

describe('parseRunArgs', () => {
  it('parses a label and command after --', () => {
    expect(parseRunArgs(['run', '--label', 'camera-backend', '--', 'go', 'test', './...'])).toEqual({
      label: 'camera-backend',
      command: ['go', 'test', './...'],
      withTimestamp: false,
      colorize: true,
    });
  });

  it('parses the --timestamps flag', () => {
    expect(parseRunArgs(['run', '--timestamps', '--label', 'vite', '--', 'vite'])).toEqual({
      label: 'vite',
      command: ['vite'],
      withTimestamp: true,
      colorize: true,
    });
  });

  it('accepts --label and --timestamps in either order', () => {
    expect(parseRunArgs(['run', '--label', 'vite', '--timestamps', '--', 'vite'])).toEqual({
      label: 'vite',
      command: ['vite'],
      withTimestamp: true,
      colorize: true,
    });
  });

  it('parses the --no-color flag', () => {
    expect(parseRunArgs(['run', '--label', 'vite', '--no-color', '--', 'vite'])).toEqual({
      label: 'vite',
      command: ['vite'],
      withTimestamp: false,
      colorize: false,
    });
  });

  it('combines --no-color with --timestamps', () => {
    expect(parseRunArgs(['run', '--no-color', '--timestamps', '--label', 'x', '--', 'echo'])).toEqual({
      label: 'x',
      command: ['echo'],
      withTimestamp: true,
      colorize: false,
    });
  });

  it('mentions --no-color in the usage message', () => {
    expect(() => parseRunArgs([])).toThrow(/\[--no-color\]/);
  });

  it('rejects a missing or unknown subcommand', () => {
    expect(() => parseRunArgs([])).toThrow(/Usage: mono-terminal run/);
    expect(() => parseRunArgs(['serve'])).toThrow(/Usage: mono-terminal run/);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseRunArgs(['run', '--bogus', '--', 'echo'])).toThrow('Unknown argument "--bogus"');
  });

  it('rejects a missing --label', () => {
    expect(() => parseRunArgs(['run', '--', 'echo'])).toThrow('Missing required --label <name>');
  });

  it('rejects an empty --label', () => {
    expect(() => parseRunArgs(['run', '--label', '', '--', 'echo'])).toThrow('Missing required --label <name>');
  });

  it('rejects a --label with no value before the -- separator', () => {
    expect(() => parseRunArgs(['run', '--label'])).toThrow('Missing required --label <name>');
  });

  it('rejects a missing -- separator', () => {
    expect(() => parseRunArgs(['run', '--label', 'x'])).toThrow('Missing "--" separator');
  });

  it('rejects a missing command after --', () => {
    expect(() => parseRunArgs(['run', '--label', 'x', '--'])).toThrow('Missing command to run after "--"');
  });
});
