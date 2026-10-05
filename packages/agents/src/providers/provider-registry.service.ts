import { Inject, Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AgentProvider } from './agent-provider';
import { ProviderRegistry } from './provider-registry';
import { RegisterAgentProvider } from './register-agent-provider';

/** The registry of the providers registered in the app (`@RegisterAgentProvider()`), found once. */
@Injectable()
export class ProviderRegistryService {
  private found: ProviderRegistry | undefined;

  constructor(@Inject(DiscoveryService) private readonly discovery: DiscoveryService) {}

  registry(): ProviderRegistry {
    this.found ??= new ProviderRegistry(
      this.discovery
        .getProviders({ metadataKey: RegisterAgentProvider.KEY })
        .map((wrapper): unknown => wrapper.instance)
        .filter((instance): instance is AgentProvider => instance instanceof AgentProvider),
    );
    return this.found;
  }
}
