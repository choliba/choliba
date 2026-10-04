import { spawn } from 'node:child_process';
import * as path from 'node:path';

const CLI_TS = path.resolve(__dirname, '../helpers/fixtures/terminal-cli.ts');
const FIXTURE_TS = path.resolve(__dirname, '../helpers/fixtures/echo-lines.ts');

interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

function runBunCli(args: readonly string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [CLI_TS, 'terminal', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

/**
 * `spawn.ts` deliberately never references the `Bun` global, so nothing in the unit
 * suite exercises the real `Bun.spawn` (see spawn.ts and
 * process-runner.spec.ts, which inject a fake spawner instead). This spec fills that
 * gap behaviorally by running `terminal run` (`TerminalModule`, wired like main.ts) as a
 * real `bun` subprocess. It does NOT move the coverage number: Istanbul only instruments the
 * Jest process, and this fixture runs in a separate `bun` process/V8 instance whose
 * coverage counters never merge back in.
 */
describe('terminal run (real Bun.spawn, real bun subprocess)', () => {
  it('formats stdout/stderr with the [label] prefix, preserves ANSI, and reflects the exit code', async () => {
    const result = await runBunCli(['run', '--label', 'demo', '--', 'bun', FIXTURE_TS]);

    expect(result.stdout).toContain('[demo]');
    expect(result.stdout).toContain('\u001b[32mPASS\u001b[0m build finished');
    expect(result.stderr).toContain('[demo]');
    expect(result.stderr).toContain('a warning on stderr');
    expect(result.exitCode).toBe(7);
  }, 15000);

  it('prints a clear error and exits non-zero on invalid CLI arguments', async () => {
    const result = await runBunCli(['run']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: choliba terminal run');
  }, 15000);
});
