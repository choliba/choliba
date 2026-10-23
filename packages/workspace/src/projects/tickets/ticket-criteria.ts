import { criteriaProblems } from '@choliba/domain';

import { readJsonFile } from '../common';

export { criteriaProblems };

/** {@link criteriaProblems} of the ticket in `file`. */
export function ticketCriteriaProblems(file: string): string[] {
  return criteriaProblems(readJsonFile(file));
}
