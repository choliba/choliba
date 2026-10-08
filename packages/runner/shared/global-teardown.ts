import { runProjectHooks } from './global-hooks';

export default async function globalTeardown(): Promise<void> {
  await runProjectHooks('global-teardown');
}
