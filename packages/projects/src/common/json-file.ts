import fs from 'node:fs';

import { ProjectsError } from './errors';

/** Reads and parses a JSON file; invalid JSON fails naming the file, the same way everywhere. */
export function readJsonFile(filePath: string): unknown {
  const text = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new ProjectsError(`${filePath} não é um JSON válido: ${(err as Error).message}`, { cause: err });
  }
}
