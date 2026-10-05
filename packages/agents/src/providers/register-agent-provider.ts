import { DiscoveryService } from '@nestjs/core';

/** Marks a provider class as an agent provider, for the registry to find (see `AgentProvider`). */
export const RegisterAgentProvider = DiscoveryService.createDecorator<undefined>();
