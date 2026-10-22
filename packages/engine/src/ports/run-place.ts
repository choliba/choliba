import type { RunPlace } from '@choliba/domain';

import type { ProviderRequest } from './provider.interface';

/** Where a request runs, for `wrapInstructions`: its run folder, the workspace, its policy and its project. */
export function runPlaceOf(request: ProviderRequest): RunPlace {
  return {
    runDir: request.runDir,
    root: request.workspaceRoot,
    policy: request.policy,
    ...(request.project === undefined ? {} : { project: request.project }),
  };
}
