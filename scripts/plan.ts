/**
 * The rules of a plan in `plans/` (skill .agents/skills/plans), as code: the
 * sections a plan must have, in order, and the approval checkbox the user
 * marks. `checkPlan` reads a plan's text; `planPath` says whether a path is a
 * plan at all. The gate (scripts/plan-gate.ts) runs both.
 */

import { UsageError } from '../src/errors';
import { isWithin, join, resolve } from '../src/filesystem/index';

/** Where the plans live, relative to the project. */
export const PLANS_DIR = 'plans';

/** The `##` sections every plan has, in this order; the approval is the last. */
export const PLAN_SECTIONS: readonly string[] = [
  'Contexto',
  'Decisões',
  'Fases',
  'Skills a consultar',
  'Verificação',
  'Fora do escopo',
  'Aprovação',
];

/**
 * The approval line, the only one in its section. A plan is born with
 * `- [] Aprovado` (no space: the user only types the `x`); approved, it reads
 * `- [x] Aprovado` (or `X`).
 */
const APPROVAL_LINE = /^- \[([xX]?)\] Aprovado$/;
const UNAPPROVED_LINE = '- [] Aprovado';

/**
 * The review line: the last of `## Fases`, below the last phase. The agent
 * runs the phases and stops; the user reviews the work and marks it, the same
 * way as the approval (`- [] Revisado` → `- [x] Revisado`).
 */
const REVIEW_LINE = /^- \[([xX]?)\] Revisado$/;
const UNREVIEWED_LINE = '- [] Revisado';

/** The line of `## Fora do escopo` every plan has: the agent commits nothing. */
const NO_COMMIT_LINE = '- Nada será commitado: o commit é do usuário.';

/** A step: a list item with a checkbox, done or not. */
const STEP_LINE = /^\s*- \[[ xX]?\] /;

/** What `checkPlan` found. */
export interface PlanCheck {
  /** What is wrong with the format, in Portuguese; empty when it is right. */
  readonly problems: readonly string[];
  /** Whether the approval line is marked. */
  readonly approved: boolean;
  /** Whether the review line (below the last phase) is marked. */
  readonly reviewed: boolean;
}

/** A heading outside code blocks: its level, text and line index. */
interface Heading {
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

/** The `#`, `##` and `###` headings, skipping fenced code (a plan may show a template). */
function headingsOf(lines: readonly string[]): Heading[] {
  const headings: Heading[] = [];
  let fenced = false;
  for (const [index, line] of lines.entries()) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    const match = fenced ? null : /^(#{1,3}) (.+)$/.exec(line);
    if (match !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: index,
      });
    }
  }
  return headings;
}

/** The lines of a section: from its heading to the next one of the same level or higher. */
function sectionLines(
  lines: readonly string[],
  headings: readonly Heading[],
  heading: Heading,
): string[] {
  const next = headings.find(
    (other) => other.line > heading.line && other.level <= heading.level,
  );
  return lines.slice(heading.line + 1, next?.line ?? lines.length);
}

/** The required sections missing or out of order, and whether the approval is last. */
function sectionProblems(sections: readonly Heading[]): string[] {
  const names = sections.map(({ text }) => text);
  const problems = PLAN_SECTIONS.filter((name) => !names.includes(name)).map(
    (name) => `Falta a seção "## ${name}".`,
  );
  const present = names.filter((name) => PLAN_SECTIONS.includes(name));
  const expected = PLAN_SECTIONS.filter((name) => names.includes(name));
  if (present.join('\n') !== expected.join('\n')) {
    problems.push(
      `As seções estão fora de ordem: a ordem é ${PLAN_SECTIONS.map((name) => `"${name}"`).join(', ')}.`,
    );
  }
  if (names.includes('Aprovação') && names.at(-1) !== 'Aprovação') {
    problems.push('A seção "## Aprovação" tem de ser a última do plano.');
  }
  return problems;
}

/** The non-empty lines of a section, trimmed. */
function filledLines(content: readonly string[]): string[] {
  return content.map((line) => line.trim()).filter((line) => line !== '');
}

/** The review line's problems, and whether it is marked: the last line of `## Fases`, once. */
function reviewOf(content: readonly string[]): {
  readonly problems: string[];
  readonly reviewed: boolean;
} {
  const filled = filledLines(content);
  const match = REVIEW_LINE.exec(filled.at(-1) ?? '');
  const count = filled.filter((line) => REVIEW_LINE.test(line)).length;
  if (match === null || count !== 1) {
    return {
      problems: [
        `A seção "## Fases" deve terminar, abaixo da última fase, com a linha "${UNREVIEWED_LINE}" (uma vez só), que o usuário marca depois de revisar.`,
      ],
      reviewed: false,
    };
  }
  return { problems: [], reviewed: match[1] !== '' };
}

/** The approval section's problems, and whether it is marked. */
function approvalOf(content: readonly string[]): {
  readonly problems: string[];
  readonly approved: boolean;
} {
  const filled = filledLines(content);
  const match =
    filled.length === 1 ? APPROVAL_LINE.exec(filled[0] ?? '') : null;
  if (match === null) {
    return {
      problems: [
        `A seção "## Aprovação" deve ter só a linha "${UNAPPROVED_LINE}" (sem espaço entre os colchetes), ou "- [x] Aprovado" depois que o usuário aprovar.`,
      ],
      approved: false,
    };
  }
  return { problems: [], approved: match[1] !== '' };
}

/**
 * Checks a plan's text: the title, the sections, each phase's steps, the
 * review line below the last phase, the no-commit line and the approval.
 */
export function checkPlan(text: string): PlanCheck {
  const lines = text.split('\n');
  const headings = headingsOf(lines);
  const problems: string[] = [];

  const first = lines.find((line) => line.trim() !== '');
  if (first === undefined || !/^# \S/.test(first)) {
    problems.push('A primeira linha deve ser o título: "# <título>".');
  }

  const sections = headings.filter(({ level }) => level === 2);
  problems.push(...sectionProblems(sections));

  for (const phase of headings.filter(
    ({ level, text: title }) => level === 3 && title.startsWith('Fase'),
  )) {
    if (
      !sectionLines(lines, headings, phase).some(
        (line) => STEP_LINE.test(line) && !REVIEW_LINE.test(line.trim()),
      )
    ) {
      problems.push(
        `A "### ${phase.text}" não tem nenhum passo com checkbox ("- [ ] …").`,
      );
    }
  }

  const section = (name: string): string[] | undefined => {
    const heading = sections.find(({ text: title }) => title === name);
    return heading === undefined
      ? undefined
      : sectionLines(lines, headings, heading);
  };

  const phases = section('Fases');
  let reviewed = false;
  if (phases !== undefined) {
    const review = reviewOf(phases);
    problems.push(...review.problems);
    reviewed = review.reviewed;
  }

  const outOfScope = section('Fora do escopo');
  if (
    outOfScope !== undefined &&
    !filledLines(outOfScope).some((line) =>
      line.startsWith('- Nada será commitado'),
    )
  ) {
    problems.push(
      `A seção "## Fora do escopo" deve dizer que nada será commitado: "${NO_COMMIT_LINE}"`,
    );
  }

  const approval = section('Aprovação');
  if (approval === undefined) return { problems, approved: false, reviewed };
  const { problems: approvalProblems, approved } = approvalOf(approval);
  return { problems: [...problems, ...approvalProblems], approved, reviewed };
}

/** `path` as an absolute plan path: refused when it is not a `.md` file inside `<project>/plans/`. */
export function planPath(path: string, project: string): string {
  const absolute = resolve(project, path);
  if (
    !isWithin(absolute, join(project, PLANS_DIR)) ||
    !absolute.endsWith('.md')
  ) {
    throw new UsageError(
      `${path} não é um plano: os planos são arquivos .md em ${PLANS_DIR}/ (veja .agents/skills/plans).`,
    );
  }
  return absolute;
}
