import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { ProviderRegistryService } from './provider-registry.service';

@Module({
  imports: [DiscoveryModule],
  providers: [ProviderRegistryService],
  exports: [ProviderRegistryService],
})
export class ProvidersModule {}
