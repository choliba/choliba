function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether `holder` (a ticket, or one of its criteria) turns `device` on: `devices.<device>: true`. */
function turnsOn(holder: unknown, device: string): boolean {
  const devices = isRecord(holder) ? holder['devices'] : undefined;
  return isRecord(devices) && devices[device] === true;
}

/**
 * Whether `device` runs: the project's `devices` (from its `config.json`) turn it on with `true`, and one it leaves
 * out is off; a project with no `devices` runs every device. The ticket, or one of its criteria, turns on a device
 * the project leaves off (`devices.<device>: true`).
 */
export function isDeviceOn(
  device: string,
  projectDevices: Readonly<Record<string, unknown>> | undefined,
  ticket: unknown,
): boolean {
  if (projectDevices === undefined || projectDevices[device] === true) return true;
  if (turnsOn(ticket, device)) return true;
  const criteria = isRecord(ticket) ? ticket['criterios'] : undefined;
  return Array.isArray(criteria) && criteria.some((criterion: unknown) => turnsOn(criterion, device));
}
