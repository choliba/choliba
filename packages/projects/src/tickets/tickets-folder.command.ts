import type { ShellIo } from '@choliba/core';

import { runSubcommand, UsageError } from '../common';
import type { TicketsService } from './tickets.service';

/** `choliba projects tickets-folder PROJECT`. */
export function runTicketsFolder(io: ShellIo, tickets: TicketsService): void {
  runSubcommand(
    io,
    () => tickets.helpSpec(),
    'tickets-folder',
    ([project]) => {
      if (!project) throw new UsageError('Missing project for tickets-folder.');
      io.write(`${tickets.folder(project)}\n`);
    },
  );
}
