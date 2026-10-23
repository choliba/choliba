import {
  everySecond,
  runAgent as runEngineAgent,
  type RunAgentDeps as EngineRunAgentDeps,
  type RunAgentRequest as EngineRunAgentRequest,
  type RunFooterInfo,
} from '@choliba/engine';
import type { Theme } from '@choliba/shell';

import { agentRenderOptions, renderEvent } from './event-render';
import type { RunScreen } from '../interfaces/run-footer.interface';

export { everySecond };

export interface RunAgentRequest extends EngineRunAgentRequest {
  readonly theme: Theme;
}

export interface RunAgentDeps extends Omit<EngineRunAgentDeps, 'render' | 'screen'> {
  readonly screen: (
    info: RunFooterInfo,
    request: RunAgentRequest,
    hostedPanel: boolean,
  ) => RunScreen | Promise<RunScreen>;
}

/** Compatibility presentation edge while callers move to the engine-owned run. */
export function runAgent(request: RunAgentRequest, deps: RunAgentDeps): Promise<number> {
  const { theme, ...engineRequest } = request;
  const agent = request.providerRequest.agent;
  return runEngineAgent(engineRequest, {
    ...deps,
    screen: (info, hostedPanel) => deps.screen(info, request, hostedPanel),
    render: (event, framed) =>
      renderEvent(event, { ...agentRenderOptions(agent.name, agent.color, theme), labeled: !framed }),
  });
}
