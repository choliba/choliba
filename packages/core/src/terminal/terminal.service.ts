import type { SignalSource, Writable } from '../platform';
import type { ThemeService } from '../theme';

import type { RunDto } from './dto/run.dto';
import type { ProcessRunnerService } from './process-runner.service';
import type { Session } from './session';
import { exitCodeFor } from './exit-code';
import type { SessionExitEvent } from './interfaces/terminal.interface';

function errorMessage(error: unknown): string {
  return String(error);
}

/**
 * `terminal run`: starts a session, prints its labeled output to stdout/stderr as it arrives,
 * forwards SIGINT/SIGTERM to the child so a wrapped dev server does not linger as an orphan,
 * and resolves with the session's exit code.
 */
export class TerminalService {
  constructor(
    private readonly runner: ProcessRunnerService,
    private readonly theme: ThemeService,
    private readonly stdout: Writable,
    private readonly stderr: Writable,
    private readonly signals: SignalSource,
  ) {}

  async run(dto: RunDto): Promise<number> {
    let session: Session;
    try {
      session = this.runner.start({
        label: dto.label,
        command: dto.command,
        withTimestamp: dto.withTimestamp,
        color: this.theme.colorOf('labels', dto.label),
        colorize: this.theme.enabled(),
      });
    } catch (error) {
      this.stderr.write(`Failed to start "${dto.command.join(' ')}": ${errorMessage(error)}\n`);
      return 1;
    }

    session.subscribe((event) => {
      const target = event.stream === 'stderr' ? this.stderr : this.stdout;
      target.write(`${event.formatted}\n`);
    });

    const exitEvent = await this.untilExit(session);
    if (exitEvent.error !== null) {
      this.stderr.write(`Session for "${dto.command.join(' ')}" failed: ${exitEvent.error}\n`);
    }
    return exitCodeFor(exitEvent);
  }

  /** Waits for the session to end, passing SIGINT/SIGTERM on to it meanwhile. */
  private async untilExit(session: Session): Promise<SessionExitEvent> {
    const onSigint = (): void => {
      session.kill('SIGINT');
    };
    const onSigterm = (): void => {
      session.kill('SIGTERM');
    };
    this.signals.on('SIGINT', onSigint);
    this.signals.on('SIGTERM', onSigterm);

    const exitEvent = await new Promise<SessionExitEvent>((resolve) => {
      session.onExit(resolve);
    });

    this.signals.off('SIGINT', onSigint);
    this.signals.off('SIGTERM', onSigterm);
    return exitEvent;
  }
}
