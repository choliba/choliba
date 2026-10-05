import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf } from '@choliba/core/cli';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { ToolsService } from './tools.service';

/** Every option goes on to the tool, `--help` included: these commands are the tool, run in the workspace. */
const PASS_THROUGH = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** Runs `tool` and passes its exit code on; an error (no workspace, a missing tool) is a message and exit 1. */
function passOn(io: CommandIo, tool: () => number): void {
  try {
    io.exit(tool());
  } catch (error) {
    io.fail(messageOf(error));
  }
}

@Command({
  name: 'lint',
  description: 'ESLint na pasta de trabalho, com a configuração que vem no choliba',
  ...PASS_THROUGH,
})
export class LintCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ToolsService) private readonly tools: ToolsService,
  ) {
    super();
  }

  run(): Promise<void> {
    passOn(this.io, () => this.tools.lint(this.io.args('lint')));
    return Promise.resolve();
  }
}

@Command({
  name: 'format',
  description: 'Prettier na pasta de trabalho: confere, ou corrige com --write',
  ...PASS_THROUGH,
})
export class FormatCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ToolsService) private readonly tools: ToolsService,
  ) {
    super();
  }

  run(): Promise<void> {
    passOn(this.io, () => this.tools.format(this.io.args('format')));
    return Promise.resolve();
  }
}
