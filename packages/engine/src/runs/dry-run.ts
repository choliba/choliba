import type { ProjectEnvironment } from '@choliba/domain';
import type { SandboxPath } from '@choliba/sandbox';

import type { PlannedFile, ProviderRequest } from '../ports';

/** What `--dry-run` shows: everything a real run of this command line would do, in order. */
export interface DryRunInput {
  readonly providerId: string;
  /** The provider's binary (`claude`, `cursor agent`...), and the arguments after it. */
  readonly command: readonly string[];
  readonly args: readonly string[];
  readonly request: ProviderRequest;
  /** Where `--type` would create the ticket; `undefined` without `--type`. */
  readonly newTicket: string | undefined;
  /** Whether the run has a ticket, which the CLI checks once the agent is done. */
  readonly hasTicket: boolean;
  /** `--show-prompt`: the prompts and the command line in full, and the files the provider would write. */
  readonly showPrompt: boolean;
  readonly workspaceFiles: readonly PlannedFile[];
  /** The project's application, which the CLI prepares and starts before anything else (`--project`). */
  readonly app?: Pick<ProjectEnvironment, 'baseURL' | 'setup' | 'start'>;
  /** `CHOL_SANDBOX=docker`: the image the provider runs in and what the container mounts. */
  readonly container?: {
    readonly image: string;
    /** `CHOL_NETWORK`: the container's network. */
    readonly network: 'isolated' | 'host';
    readonly mounts: readonly SandboxPath[];
    /** What the agent may reach that the image keeps as its own (`isImagePath`). */
    readonly skipped: readonly string[];
  };
  /** `CHOL_SANDBOX=local`: what `bwrap` mounts. */
  readonly local?: {
    readonly mounts: readonly SandboxPath[];
    /** What the agent may reach that stays the system's, so not mounted on its own. */
    readonly skipped: readonly string[];
  };
}
