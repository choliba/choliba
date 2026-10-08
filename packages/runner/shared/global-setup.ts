import { runProjectHooks } from './global-hooks';

export default async function globalSetup(): Promise<void> {
  await runProjectHooks('global-setup');
}
