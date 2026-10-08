import { Inject, Injectable } from '@nestjs/common';

import { CWD, STDERR, type Writable, RUNTIME } from '@choliba/core';

import { AddService } from '../add/nest';
import type { CliRuntime } from '../runtime';
import type { NewOptions } from './new-options';
import { type NewResult, newWorkspace } from './new-workspace';
import { defaultsPrompter } from '../runtime';

/** `choliba new`: the assistant, asking on a terminal and taking the defaults without one or with `--no-input`. */
@Injectable()
export class NewService {
  constructor(
    @Inject(CWD) private readonly cwd: string,
    @Inject(STDERR) private readonly stderr: Writable,
    @Inject(RUNTIME) private readonly runtime: CliRuntime,
    @Inject(AddService) private readonly adder: AddService,
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
      add: (dir, args) => this.adder.addTo(dir, this.cwd, args),
    });
  }
}
