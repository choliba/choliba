import { runProjectHooks } from './globalHooks';

export default async function globalSetup(): Promise<void> {
  await runProjectHooks('global-setup');
}
