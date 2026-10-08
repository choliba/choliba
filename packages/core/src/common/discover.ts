import type { DiscoveryService } from '@nestjs/core';

/** A marker made by `DiscoveryService.createDecorator()`: the metadata key providers are found by. */
interface DiscoveryMarker {
  readonly KEY: string;
}

/**
 * The instances of the providers marked with `marker` that are what `is` asks for, in the order the app
 * registered them (its modules' imports, then each module's providers): how a module finds what others offer it
 * without importing them.
 */
export function discover<T>(
  discovery: DiscoveryService,
  marker: DiscoveryMarker,
  is: (value: unknown) => value is T,
): T[] {
  return discovery
    .getProviders({ metadataKey: marker.KEY })
    .map((wrapper): unknown => wrapper.instance)
    .filter(is);
}
