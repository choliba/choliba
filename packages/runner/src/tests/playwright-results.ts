export interface FlatTestResult {
  fullTitle: string;
  projectName?: string;
  status: string;
  results: unknown[];
}

interface PwSuite {
  title: string;
  specs?: { title: string; tests?: { projectName?: string; status: string; results?: unknown[] }[] }[];
  suites?: PwSuite[];
}

export function flattenResults(suites: PwSuite[], pathSegments: string[] = []): FlatTestResult[] {
  let list: FlatTestResult[] = [];
  for (const suite of suites) {
    const nextPath = [...pathSegments, suite.title];
    for (const spec of suite.specs ?? []) {
      const fullTitle = [...nextPath, spec.title].join(' › ');
      for (const test of spec.tests ?? []) {
        list.push({
          fullTitle,
          ...(test.projectName ? { projectName: test.projectName } : {}),
          status: test.status,
          results: test.results ?? [],
        });
      }
    }
    list = list.concat(flattenResults(suite.suites ?? [], nextPath));
  }
  return list;
}

export function isRealFailure(status: string): boolean {
  return !['expected', 'flaky', 'skipped'].includes(status);
}
