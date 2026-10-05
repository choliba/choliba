/** What to tell the person about something thrown: an Error's message, or the value itself. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
