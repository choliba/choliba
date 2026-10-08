import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliCommand, CommandIo, ConfigService, RegisterHelp } from '@choliba/core/nest';
import { ENV, type Environment, RUNTIME, entryHelp, type CommandEntry, type HelpContributor } from '@choliba/core';

import type { Runtime } from '../runtime';
import { setup, setupWorkspace, updatePackageWhenListed } from './setup';

/** How `choliba --help` lists `setup`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'setup',
  description: 'Liga o autocomplete no bash (roda sozinho ao instalar com --trust)',
  group: 'Commands',
  spec: { usage: 'choliba setup' },
};

/**
 * `choliba setup`, also the postinstall: the workspace structure, bash completion and what to do next.
 * `--deferred` is its second half, run in the background once `bun add` has written package.json.
 */
@RegisterHelp()
@Command({
  name: 'setup',
  description: 'Liga o autocomplete no bash (roda sozinho ao instalar com --trust)',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class SetupCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RUNTIME) private readonly runtime: Runtime,
    @Inject(ENV) private readonly env: Environment,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  async run(): Promise<void> {
    const args = this.io.args('setup');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(entryHelp(ENTRY));
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
