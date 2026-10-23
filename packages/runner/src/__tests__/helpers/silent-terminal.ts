import * as terminalOutput from '@choliba/shell';

export function installSilentTerminal(): () => void {
  const stderrSpy = jest.spyOn(terminalOutput, 'writeStderr').mockImplementation(() => undefined);
  const stdoutSpy = jest.spyOn(terminalOutput, 'writeStdout').mockImplementation(() => undefined);
  return () => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  };
}
