import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { validateAgentYamlV1, type ValidationResult } from '@choliba/domain';
import { AGENT_FILE } from '@choliba/workspace';

export function validateAgentFiles(agentsDir: string, name: string): ValidationResult {
  const path = join(agentsDir, name, AGENT_FILE);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { valid: false, errors: [`${path}: arquivo não encontrado`] };
  }
  const validation = validateAgentYamlV1(text, name);
  return { valid: validation.valid, errors: validation.errors.map((error) => `${path}: ${error}`) };
}
