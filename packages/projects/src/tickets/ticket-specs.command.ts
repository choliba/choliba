import type { ShellIo } from '@choliba/core';

import { runSubcommand, UsageError } from '../common';
import type { TicketsService } from './tickets.service';

/** `choliba projects ticket-specs PROJECT TICKET`. */
export function runTicketSpecs(io: ShellIo, tickets: TicketsService): void {
  runSubcommand(
    io,
    () => tickets.helpSpec(),
    'ticket-specs',
    ([project, ticket]) => {
      if (!project || !ticket) throw new UsageError('Missing project or ticket for ticket-specs.');
      for (const spec of tickets.specFiles(project, ticket)) {
        io.write(`${spec}\n`);
      }
    },
  );
}
