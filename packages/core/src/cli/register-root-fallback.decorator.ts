import { DiscoveryService } from '@nestjs/core';

/** Marks the provider that runs a first word that is not a command (a `RootFallback`). */
export const RegisterRootFallback = DiscoveryService.createDecorator<undefined>();
