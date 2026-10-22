import type { ShellModule } from '@choliba/core';

import { AGENT_PROVIDERS, knownProviders } from '../..';

/** What the app registers as `AGENT_PROVIDERS`, for specs that build a shell without the app. */
export const knownProvidersShell: ShellModule = {
  name: 'known-providers',
  provide: (container) => {
    container.provide(AGENT_PROVIDERS, () => knownProviders());
  },
  commands: [],
};
