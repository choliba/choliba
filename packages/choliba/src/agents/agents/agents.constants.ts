import { token } from '@choliba/kernel';

import type { ProviderRegistry } from '@choliba/engine';
import type { AgentsService } from './agents.service';

/** The agent providers choliba knows (claude, cursor), in the order `auto` breaks ties by. */
export const AGENT_PROVIDERS = token<ProviderRegistry>('ProviderRegistry');

/** What runs `choliba run agent` and `choliba list agents`. */
export const AGENTS = token<AgentsService>('AgentsService');
