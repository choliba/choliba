import { runProjectHooks } from './globalHooks';

export default async function globalTeardown(): Promise<void> {
  await runProjectHooks('global-teardown');
}
