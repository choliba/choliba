import { token } from '@choliba/kernel';

import type { ToolsService } from './tools.service';

/** What runs `choliba lint` and `choliba format`. */
export const TOOLS = token<ToolsService>('ToolsService');
