import type { ShellModule } from '@choliba/shell';

import { testsCommand } from './tests.command';

/** The app-owned command that uses the runner package's test service. */
export const testsCommandsShell: ShellModule = {
  name: 'choliba-tests-commands',
  commands: [testsCommand],
};
