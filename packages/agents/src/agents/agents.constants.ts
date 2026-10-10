import { token } from '@choliba/core';

import type { ProviderRegistry } from '../common';
import type { AgentsService } from './agents.service';

/** The agent providers choliba knows (claude, cursor), in the order `auto` breaks ties by. */
export const AGENT_PROVIDERS = token<ProviderRegistry>('ProviderRegistry');

/** What runs `choliba agents` and `choliba <agent>`. */
export const AGENTS = token<AgentsService>('AgentsService');
