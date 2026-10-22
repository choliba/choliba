import fs from 'node:fs';

import { parseProjectStack as parseStack, type ProjectStack, type ProjectStackItem } from '@choliba/domain';

import { ProjectsError, readJsonFile, wrapProjects } from '../common';
import { assertProjectExists, configJsonPath } from '../paths';

export type { ProjectStack, ProjectStackItem };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value` as a stack, or why it is not one: `where` names it in the message (`config.stack`). */
export function parseProjectStack(value: unknown, where: string): ProjectStack {
  return wrapProjects(() => parseStack(value, where));
}

/** The keys of `config.json` a step may write, each with the rule its value must follow. */
const WRITABLE_KEYS: Readonly<Record<string, (value: unknown, where: string) => unknown>> = {
  stack: parseProjectStack,
};

/** The keys of `config.json` that `writeProjectConfigKey` writes. */
export const PROJECT_CONFIG_KEYS: readonly string[] = Object.keys(WRITABLE_KEYS);

/**
 * Sets `key` of `project`'s `config.json` to `value`, once `value` follows the key's rule; the other keys stay as
 * they are, in their order. A missing project, an unknown key, a value outside the rule or a file that is not a JSON
 * object throws `ProjectsError`, and the file is left untouched.
 */
export function writeProjectConfigKey(projectsDir: string, project: string, key: string, value: unknown): void {
  assertProjectExists(projectsDir, project);
  const file = configJsonPath(projectsDir, project);
  const parse = WRITABLE_KEYS[key];
  if (parse === undefined) {
    throw new ProjectsError(`config.${key} não pode ser gravado (aceitos: ${PROJECT_CONFIG_KEYS.join(', ')}).`);
  }
  const checked = parse(value, `config.${key}`);
  const config = readJsonFile(file);
  if (!isRecord(config)) throw new ProjectsError(`${file}: o conteúdo precisa ser um objeto JSON.`);
  fs.writeFileSync(file, `${JSON.stringify({ ...config, [key]: checked }, null, 2)}\n`);
}
