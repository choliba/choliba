import type { SandboxBackend, SandboxPlan, SandboxPlanInput } from '../interfaces/sandbox-backend.interface';

export class LocalSandbox implements SandboxBackend {
  readonly kind = 'local';

  plan(input: SandboxPlanInput): SandboxPlan {
    return { command: input.command, place: { kind: 'local' }, paths: [], skipped: [] };
  }
}
