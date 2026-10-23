import type { AgentEvent, PlanContentContext } from '../ports';

export interface ReportedModelContext {
  readonly providerId: string;
  readonly agentName: string;
}

export function validateReportedModel(
  model: string,
  supportedModels: readonly string[],
  context: ReportedModelContext,
): string | undefined {
  if (supportedModels.length === 0 || supportedModels.includes(model)) return undefined;
  return (
    `${context.providerId} is using model "${model}", not declared in agent.yaml#providers.${context.providerId}.models ` +
    `for "${context.agentName}". Supported: ${supportedModels.join(', ')}. Stopping.`
  );
}

export function modelReportMissingMessage(supportedModels: readonly string[], context: ReportedModelContext): string {
  return (
    `${context.providerId} did not report a model before starting work for "${context.agentName}" ` +
    `(agent.yaml#providers.${context.providerId}.models requires one of: ${supportedModels.join(', ')}). ` +
    'Pass --model explicitly or fix the provider stream parser. Stopping.'
  );
}

export function validateModelReportMissing(
  supportedModels: readonly string[],
  context: ReportedModelContext,
): string | undefined {
  return supportedModels.length === 0 ? undefined : modelReportMissingMessage(supportedModels, context);
}

export function isSubstantiveAgentEvent(event: AgentEvent): boolean {
  return event.type === 'text' || event.type === 'tool-call';
}

export function defaultResolvePlanContent(context: PlanContentContext): string | undefined {
  const candidates = [context.planMarkdown, context.doneEvent?.text, context.textParts.join('\n\n')];
  return candidates.find((candidate) => candidate !== undefined && candidate.trim() !== '');
}
