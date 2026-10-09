import path from 'node:path';

import type { Prompter } from '../runtime';
import { GenerateProjectDto, type GenerateProjectInput } from './dto/generate-project.dto';

const APP_DIR_QUESTION = 'Pasta da aplicação (o código que os testes exercitam)?';

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

async function askAppDir(input: GenerateProjectInput, prompter: Prompter): Promise<string> {
  return input.appDir ?? prompter.text(APP_DIR_QUESTION, '--app-dir');
}

async function askName(appDir: string, prompter: Prompter): Promise<string> {
  const fallback = path.basename(appDir);
  const answer = (await prompter.text('Nome do projeto?', 'PROJECT', fallback)).trim();
  if (answer !== '') return answer;
  return fallback;
}

async function askBaseUrl(prompter: Prompter): Promise<string | undefined> {
  return blankToUndefined(await prompter.text('URL base do projeto (--base-url)?', '--base-url', ''));
}

/**
 * The project to create. On a terminal, a missing `--app-dir` opens the questions (name and URL too, unless
 * already given). With `--app-dir` alone, the name is the folder's and the URL stays unset. Without a
 * terminal, or with `--no-input`, the prompter is the one that fails naming `--app-dir`.
 */
export async function resolveGenerateProject(
  input: GenerateProjectInput,
  cwd: string,
  prompter: Prompter,
): Promise<GenerateProjectDto> {
  const appDir = path.resolve(cwd, await askAppDir(input, prompter));
  if (input.appDir !== undefined) {
    return new GenerateProjectDto(input.project ?? path.basename(appDir), appDir, input.baseUrl);
  }
  const project = input.project ?? (await askName(appDir, prompter));
  const baseUrl = input.baseUrl ?? (await askBaseUrl(prompter));
  return new GenerateProjectDto(project, appDir, baseUrl);
}
