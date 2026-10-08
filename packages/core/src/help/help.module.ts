import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CliHelpService } from './cli-help.service';
import { HelpRegistryService } from './help-registry.service';

/**
 * The help, owned by core: what every command prints from its `CommandSpec` (`CliHelpService`) and the registry of
 * the commands that show up in the app's root help (`HelpRegistryService`, fed by `@RegisterHelp()`).
 */
@Module({
  imports: [DiscoveryModule],
  providers: [CliHelpService, HelpRegistryService],
  exports: [CliHelpService, HelpRegistryService],
})
export class HelpModule {}
