import { token } from '@choliba/core';

import type { ToolsService } from './tools.service';

/** What runs `choliba lint` and `choliba format`. */
export const TOOLS = token<ToolsService>('ToolsService');
