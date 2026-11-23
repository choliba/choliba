/** The commands of the `choliba` command line: what each one runs and the line the general help shows for it. */

import { approvalsCommand } from './approvals';
import { clearCommand } from './clear';
import { roundsCommand, roundsWebCommand } from './rounds';

export interface CliCommand {
  readonly run: (argv: readonly string[]) => Promise<void>;
  readonly summary: string;
}

export const COMMANDS: Readonly<Record<string, CliCommand>> = {
  rounds: {
    run: roundsCommand,
    summary: 'roda uma rodada: choliba rounds <id>',
  },
  'rounds:web': {
    run: roundsWebCommand,
    summary: 'serve as páginas das rodadas',
  },
  approvals: {
    run: approvalsCommand,
    summary: 'revisa e aprova os comandos negados pelo gate',
  },
  clear: {
    run: clearCommand,
    summary: 'apaga logs, workspaces, homes e rodadas',
  },
};
