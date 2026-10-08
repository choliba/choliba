import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@choliba/core/nest';
import { STDERR, type Writable, RUNTIME } from '@choliba/core';

import { defaultsPrompter } from '../new/prompter';
import type { CliRuntime } from '../runtime/interfaces/runtime.interface';
import type { AgentNewOptions } from './agent-options';
import { type CreatedAgent, createAgent } from './create-agent';

/** `choliba-cli agent new`, in the workspace the command runs in. */
@Injectable()
export class AgentService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(STDERR) private readonly stderr: Writable,
    @Inject(RUNTIME) private readonly runtime: CliRuntime,
  ) {}

  create(options: AgentNewOptions): Promise<CreatedAgent> {
    const asks = this.runtime.interactive && !options.noInput;
    return createAgent(options, {
      root: this.config.workspaceRoot(),
      prompter: asks ? this.runtime.prompter : defaultsPrompter,
      run: this.runtime.run,
      say: (line) => {
        this.stderr.write(`${line}\n`);
      },
    });
  }
}
