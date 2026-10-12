import type { SandboxBackend, SandboxPlan, SandboxPlanInput } from './sandbox-backend';

export class LocalSandbox implements SandboxBackend {
  readonly kind = 'local';

  plan(input: SandboxPlanInput): SandboxPlan {
    return { command: input.command, place: { kind: 'local' }, paths: [], skipped: [] };
  }
}
