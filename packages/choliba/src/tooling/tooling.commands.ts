import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf } from '@choliba/core/cli';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { DEFAULT_OUTPUT_DIR, intoOutputDir } from './playwright-args';
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

/** `choliba playwright-cli …`: the browser the agents use, writing what it names itself under the workspace's folder. */
@Command({ name: 'playwright-cli', description: 'O navegador que os agentes usam (playwright cli)', ...PASS_THROUGH })
export class PlaywrightCliCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ToolsService) private readonly tools: ToolsService,
  ) {
    super();
  }

  run(): Promise<void> {
    passOn(this.io, () => {
      const outputDir = this.tools.workspaceConfig()['CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR'] ?? DEFAULT_OUTPUT_DIR;
      return this.tools.playwright('cli', intoOutputDir(this.io.args('playwright-cli'), outputDir));
    });
    return Promise.resolve();
  }
}

/** `choliba playwright-trace …`: reads the trace.zip of a failed test, with the runner's Playwright. */
@Command({
  name: 'playwright-trace',
  description: 'Lê um trace.zip de teste que falhou (playwright trace), na versão do runner',
  ...PASS_THROUGH,
})
export class PlaywrightTraceCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ToolsService) private readonly tools: ToolsService,
  ) {
    super();
  }

  run(): Promise<void> {
    passOn(this.io, () => this.tools.playwright('trace', this.io.args('playwright-trace')));
    return Promise.resolve();
  }
}
