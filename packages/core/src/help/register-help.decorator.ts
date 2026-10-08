import { DiscoveryService } from '@nestjs/core';

/** Marks a command as a `HelpContributor`, for the app's root help and completion to list it. */
export const RegisterHelp = DiscoveryService.createDecorator<undefined>();
