import path from 'node:path';

import { findResource } from '@choliba/kernel';

/** `templates/project/` shipped with the app: what `choliba setup` copies into the example project. */
export function projectTemplatesDir(): string {
  return findResource(path.join('templates', 'project'), __dirname);
}

/** `templates/ticket/` shipped with the app: one `<type>.json` per ticket type. */
export function ticketTemplatesDir(): string {
  return findResource(path.join('templates', 'ticket'), __dirname);
}
