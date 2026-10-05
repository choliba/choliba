import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf } from '@choliba/core/cli';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { commandHelp } from '../help/app.help';
import { InstallService } from './install.service';

@Command({
  name: 'install',
  description: 'Instala um agente (com suas skills e MCPs), uma skill ou um MCP',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class InstallCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(InstallService) private readonly installer: InstallService,
  ) {
    super();
  }

  run(): Promise<void> {
    const args = this.io.args('install');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(commandHelp('install'));
      return Promise.resolve();
    }
    try {
      this.io.write(`${this.installer.install(args)}\n`);
    } catch (error) {
      this.io.fail(messageOf(error));
    }
    return Promise.resolve();
  }
}
