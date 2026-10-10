import { parseRunArgs, RunDto } from '../../terminal/dto/run.dto';

describe('parseRunArgs', () => {
  it('builds a RunDto', () => {
    expect(parseRunArgs(['run', '--label', 'x', '--', 'echo'])).toBeInstanceOf(RunDto);
  });

  it('parses a label and command after --', () => {
    expect(parseRunArgs(['run', '--label', 'camera-backend', '--', 'go', 'test', './...'])).toEqual({
      label: 'camera-backend',
      command: ['go', 'test', './...'],
      withTimestamp: false,
    });
  });

  it('parses the --timestamps flag', () => {
    expect(parseRunArgs(['run', '--timestamps', '--label', 'vite', '--', 'vite'])).toEqual({
      label: 'vite',
      command: ['vite'],
      withTimestamp: true,
    });
  });

  it('accepts --label and --timestamps in either order', () => {
    expect(parseRunArgs(['run', '--label', 'vite', '--timestamps', '--', 'vite'])).toEqual({
      label: 'vite',
      command: ['vite'],
      withTimestamp: true,
    });
  });

  it('rejects a missing or unknown subcommand', () => {
    expect(() => parseRunArgs([])).toThrow(/Usage: choliba terminal run/);
    expect(() => parseRunArgs(['serve'])).toThrow(/Usage: choliba terminal run/);
  });

  it('rejects an unknown flag (--no-color is global: it never gets here)', () => {
    expect(() => parseRunArgs(['run', '--no-color', '--label', 'x', '--', 'echo'])).toThrow(
      'Unknown argument "--no-color"',
    );
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
