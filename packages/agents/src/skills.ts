import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

import { parse as parseYaml } from 'yaml';

import type { SkillDeclaration } from './agent.types';
import { asString, isRecord } from './json';
import { SKILL_FILE } from '@choliba/core/config';

/** One skill an agent declares; the agent reads the skill itself from `path`. */
export interface SkillSummary {
  readonly name: string;
  readonly description: string;
  /** Absolute path of the skill's `SKILL.md`. */
  readonly path: string;
  /** How this agent uses the skill (`agent.yaml#skills.<name>.instructions`). */
  readonly instructions?: string;
}

export class SkillError extends Error {}

/** The `description` from a `SKILL.md`'s YAML frontmatter (`---` ... `---` at the top). */
export function skillDescription(text: string, source: string): string {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (frontmatter === undefined) {
    throw new SkillError(`${source}: sem frontmatter YAML (--- ... ---) no topo.`);
  }
  let doc: unknown;
  try {
    doc = parseYaml(frontmatter) as unknown;
  } catch (error) {
    throw new SkillError(`${source}: frontmatter YAML inválido (${String(error)}).`);
  }
  const description = isRecord(doc) ? asString(doc['description']) : undefined;
  if (description === undefined || description.trim() === '') {
    throw new SkillError(`${source}: falta "description" no frontmatter.`);
  }
  return description.trim();
}

/**
 * Finds each skill an agent lists (`agent.yaml#skills`) as `<skillsDir>/<name>/SKILL.md` and
 * reads its description. A missing or malformed skill fails the run up front, naming the file,
 * instead of the agent silently running without it.
 */
export function resolveSkills(skillsDir: string, declarations: readonly SkillDeclaration[]): readonly SkillSummary[] {
  return declarations.map(({ name, instructions }) => {
    const path = join(skillsDir, name, SKILL_FILE);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      throw new SkillError(`skill "${name}" não encontrada: ${path} não existe.`);
    }
    const summary = { name, description: skillDescription(text, path), path };
    return instructions === undefined ? summary : { ...summary, instructions };
  });
}

/** A skill's path as the agent should see it: from the repo root when inside it, absolute otherwise. */
function displayPath(path: string, repoRoot: string): string {
  const fromRoot = relative(repoRoot, path);
  return fromRoot.startsWith('..') || isAbsolute(fromRoot) ? path : fromRoot;
}

/** The order to use one skill, followed by how this agent uses it, when `agent.yaml` says. */
function skillLines(skill: SkillSummary, repoRoot: string): readonly string[] {
  const order = `Utilize a skill ${skill.name}: leia \`${displayPath(skill.path, repoRoot)}\` antes de qualquer outra coisa e siga-a durante toda a tarefa.`;
  return skill.instructions === undefined
    ? [order]
    : [order, `<skill_instructions name="${skill.name}">`, skill.instructions.trim(), '</skill_instructions>'];
}

/**
 * The order to use the agent's skills, one line per skill with the path of its `SKILL.md` (the
 * agent reads each one itself, before anything else), each followed by how this agent uses it
 * (`agent.yaml#skills.<name>.instructions`). It goes at the top of the agent's instructions
 * (`wrapInstructions`), not in the user prompt: Claude receives the instructions as a system prompt,
 * and a pointer in the user prompt lost to the workflow those instructions lay out.
 */
export function formatSkillsInstruction(skills: readonly SkillSummary[], repoRoot: string): string {
  if (skills.length === 0) {
    return '';
  }
  return [
    ...skills.flatMap((skill) => skillLines(skill, repoRoot)),
    'Esses caminhos partem da raiz do repositório. Abra os arquivos que uma skill indicar (ex.: references/) só quando ela mandar.',
  ].join('\n');
}
