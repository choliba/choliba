import {
  complete,
  describe as describeCommand,
  FILES_MARKER,
  formatHelp,
  formatSuggestions,
  HELP_WIDTH,
  scriptSummary,
  fileSummary,
  OTHER_GROUP,
  resolveScriptFile,
  readPackageScripts,
  resolveScriptCli,
  scriptsHelpSpec,
} from '../../help';

describe('help barrel exports', () => {
  it('re-exports the completion and help helpers', () => {
    expect(complete({ usage: 'x' }, [''])).toEqual({ kind: 'values', values: [] });
    expect(formatSuggestions({ kind: 'files' })).toBe(FILES_MARKER);
    expect(formatHelp({ usage: 'x' })).toBe('Usage:  x');
    expect(HELP_WIDTH).toBe(80);
    expect(describeCommand({ usage: 'x', description: 'd' }, [])).toBe('d');
    const pkg = readPackageScripts({});
    expect(scriptSummary({ a: 'x' }, 'a', '/repo')).toBe('x');
    expect(resolveScriptFile({}, 'x', '/repo')).toBeUndefined();
    expect(OTHER_GROUP).toBe('Outros');
    expect(typeof fileSummary).toBe('function');
    expect(resolveScriptCli({}, 'x', '/repo')).toBeUndefined();
    expect(scriptsHelpSpec(pkg, '/repo', () => '').usage).toBe('bun run SCRIPT [ARGS]');
  });
});
