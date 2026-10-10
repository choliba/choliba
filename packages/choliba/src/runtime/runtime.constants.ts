import { token } from '@choliba/core';

import type { Runtime } from './interfaces/runtime.interface';

/** The app's runtime in the shell: what `main.ts` reads from Bun and the machine beyond the platform. */
export const RUNTIME = token<Runtime>('Runtime');
