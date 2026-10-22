/** The suffix of `ticket` once the `{project}-` prefix is stripped, or `ticket` when it has none. */
export function ticketSuffix(project: string, ticket: string): string {
  const prefix = `${project}-`;
  return ticket.startsWith(prefix) ? ticket.slice(prefix.length) : ticket;
}

/** The full ticket key: `{project}-{suffix}`, unchanged when `ticketOrSuffix` already has the prefix. */
export function fullTicket(project: string, ticketOrSuffix: string): string {
  const prefix = `${project}-`;
  return ticketOrSuffix.startsWith(prefix) ? ticketOrSuffix : `${prefix}${ticketOrSuffix}`;
}
