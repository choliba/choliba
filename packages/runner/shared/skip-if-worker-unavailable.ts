import { test, type TestInfo } from '@playwright/test';

export function skipIfWorkerUnavailable(workerRunning: string | undefined, _testInfo: TestInfo): void {
  const shouldRun = (workerRunning ?? 'TRUE').trim().toUpperCase() !== 'FALSE';
  test.skip(!shouldRun, 'WORKER_RUNNING=FALSE em .env.json — pulando trecho que depende de worker ou fila externa.');
}
