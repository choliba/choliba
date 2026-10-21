// Fakes of what `main.ts` gives the rest from the process, for specs: the platform, its signals and its streams.
export { BufferWritable } from './buffer-writable';
export { FAKE_NOW, fakePlatform } from './fake-platform';
export { FakeSignals } from './fake-signals';
export type { FakePlatform } from './interfaces/fake-platform.interface';
