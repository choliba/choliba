import { Inject, Injectable } from '@nestjs/common';

import { CWD, STDERR, type Writable } from '@choliba/core/platform';

import type { CliRuntime } from '../runtime/interfaces/runtime.interface';
import { RUNTIME } from '../runtime/runtime.constants';
import type { NewOptions } from './new-options';
import { type NewResult, newWorkspace } from './new-workspace';
import { defaultsPrompter } from './prompter';

/** `choliba-cli new`: the assistant, asking on a terminal and taking the defaults without one or with `--no-input`. */
@Injectable()
export class NewService {
  constructor(
    @Inject(CWD) private readonly cwd: string,
    @Inject(STDERR) private readonly stderr: Writable,
    @Inject(RUNTIME) private readonly runtime: CliRuntime,
  ) {}

  create(options: NewOptions): Promise<NewResult> {
    const asks = this.runtime.interactive && !options.noInput;
    return newWorkspace(options, {
      cwd: this.cwd,
      prompter: asks ? this.runtime.prompter : defaultsPrompter,
      run: this.runtime.run,
      say: (line) => {
        this.stderr.write(`${line}\n`);
      },
    });
  }
}
