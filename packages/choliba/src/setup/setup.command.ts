import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliCommand, CommandIo, ConfigService } from '@choliba/core/nest';
import { ENV, type Environment } from '@choliba/core';

import { commandHelp } from '../help/app.help';
import type { Runtime } from '../runtime/interfaces/runtime.interface';
import { RUNTIME } from '../runtime/runtime.constants';
import { setup, setupWorkspace, updatePackageWhenListed } from './setup';

/**
 * `choliba setup`, also the postinstall: the workspace structure, bash completion and what to do next.
 * `--deferred` is its second half, run in the background once `bun add` has written package.json.
 */
@Command({
  name: 'setup',
  description: 'Liga o autocomplete no bash (roda sozinho ao instalar com --trust)',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class SetupCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RUNTIME) private readonly runtime: Runtime,
    @Inject(ENV) private readonly env: Environment,
  ) {
    super();
  }

  async run(): Promise<void> {
    const args = this.io.args('setup');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(commandHelp('setup'));
      return;
    }
    const cwd = this.config.startDir();
    if (args.includes('--deferred')) {
      await updatePackageWhenListed(cwd, (ms) => this.runtime.sleep(ms));
      return;
    }
    const message = `${setup(this.runtime.home, cwd, () => {
      // Outlives the postinstall: finishes once `bun add` has written package.json.
      this.runtime.spawnDetached(
        [this.runtime.execPath, this.runtime.script, 'setup', '--deferred'],
        setupWorkspace(cwd),
      );
    })}\n`;
    // Bun hides a postinstall's output; the terminal itself still shows what is written to it.
    if (this.env['npm_lifecycle_event'] === 'postinstall' && this.runtime.writeTerminal(message)) return;
    this.io.write(message);
  }
}
