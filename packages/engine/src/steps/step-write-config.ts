import { PROJECT_CONFIG_KEYS, writeProjectConfigKey } from '@choliba/workspace';

import type { AgentStep } from '@choliba/domain';
import { textField, type FieldSpec } from './step-fields';
import { answerContent } from './step-write-files';

export const WRITE_CONFIG_USAGE = 'write_config: { key }';

export const WRITE_CONFIG_FIELDS: FieldSpec = {
  required: ['key'],
  optional: [],
  lists: [],
  rule: (step) => {
    const key = textField(step, 'key');
    return PROJECT_CONFIG_KEYS.includes(key)
      ? undefined
      : `o campo "key" é uma chave do config.json que o choliba grava (${PROJECT_CONFIG_KEYS.join(', ')})`;
  },
};

/** The agent's answer as JSON: without a code block that wraps all of it; text that is not JSON fails saying so. */
export function answerJson(answer: string | undefined): unknown {
  if (answer === undefined || answer.trim() === '') {
    throw new Error('o agente não deu resposta para gravar');
  }
  try {
    return JSON.parse(answerContent(answer)) as unknown;
  } catch (error) {
    throw new Error(`a resposta do agente não é um JSON: ${(error as Error).message}`, { cause: error });
  }
}

/** The project a run is for (`--project`): where the projects live, and its name. */
export interface StepProject {
  readonly projectsDir: string;
  readonly name: string;
}

/**
 * The `write_config` action: the agent's final answer, a JSON value, saved by `@choliba/workspace` as `key` of the
 * run's project's `config.json`, once it follows that key's rule. The other keys stay as they are; a run without a
 * project, or an answer that is not JSON or does not follow the rule, fails and leaves the file untouched.
 */
export function writeConfig(project: StepProject | undefined, answer: string | undefined, step: AgentStep): void {
  if (project === undefined) throw new Error('write_config grava no config.json do projeto: rode com --project');
  writeProjectConfigKey(project.projectsDir, project.name, textField(step, 'key'), answerJson(answer));
}
