import { readJsonFile } from '../shared/json-file';

/** The steps of a criterion, in the order they must first appear; `E` and `Mas` continue the one before. */
const MAIN_KEYWORDS = ['Dado', 'Quando', 'Então'] as const;

const KEYWORDS = [...MAIN_KEYWORDS, 'E', 'Mas'] as const;

const KEYWORD_LIST = KEYWORDS.join(', ');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The keyword `step` starts with (followed by a space or a comma: `Então, ao atualizar…`), if any. */
function keywordOf(step: string): string | undefined {
  return KEYWORDS.find((keyword) => step.startsWith(`${keyword} `) || step.startsWith(`${keyword},`));
}

/**
 * What is wrong with step `index`, given how many main keywords came before it (`reached`): the first step is
 * `Dado`, and `Dado`, `Quando` and `Então` each appear once, in that order.
 */
function stepProblem(step: unknown, index: number, reached: number): string | undefined {
  if (typeof step !== 'string' || step.trim() === '') return 'frase vazia';
  const keyword = keywordOf(step);
  if (keyword === undefined) return `frase sem palavra-chave (${KEYWORD_LIST}): "${step}"`;
  if (index === 0 && keyword !== 'Dado') return `a primeira frase começa com "Dado" ("${step}")`;
  const order = MAIN_KEYWORDS.findIndex((main) => main === keyword);
  if (order === -1 || order === reached) return undefined;
  if (order < reached) return `"${keyword}" repetido; continue com "E" ou "Mas"`;
  return `"${keyword}" antes de "${String(MAIN_KEYWORDS[reached])}"`;
}

/**
 * The first problem of one `descricao`, prefixed by its field path (`criterios[0].descricao[1]`); the others
 * usually follow from it.
 */
function descriptionProblem(description: unknown, where: string): string | undefined {
  if (!Array.isArray(description)) {
    return `${where}: deve ser uma lista de frases (Dado…, Quando…, Então…), não um texto`;
  }
  let reached = 0;
  for (const [index, step] of description.entries()) {
    const problem = stepProblem(step, index, reached);
    if (problem !== undefined) return `${where}[${String(index)}]: ${problem}`;
    if (keywordOf(String(step)) === MAIN_KEYWORDS[reached]) reached += 1;
  }
  const missing = MAIN_KEYWORDS.slice(reached).map((keyword) => `"${keyword}"`);
  return missing.length > 0 ? `${where}: falta ${missing.join(', ')}` : undefined;
}

/**
 * Where a ticket's criteria break the Gherkin form, one problem per criterion: each `criterios[].descricao` is a
 * list of sentences, the first `Dado`, then one `Quando` and one `Então`, with `E`/`Mas` continuing any of them.
 * There is no `Ou`: each path is a criterion of its own. None when every criterion is in form.
 */
export function criteriaProblems(ticket: unknown): string[] {
  const criteria = isRecord(ticket) ? ticket['criterios'] : undefined;
  if (!Array.isArray(criteria)) return [];
  return criteria.flatMap((criterion: unknown, index) => {
    const problem = isRecord(criterion)
      ? descriptionProblem(criterion['descricao'], `criterios[${String(index)}].descricao`)
      : undefined;
    return problem === undefined ? [] : [problem];
  });
}

/** {@link criteriaProblems} of the ticket in `file`. */
export function ticketCriteriaProblems(file: string): string[] {
  return criteriaProblems(readJsonFile(file));
}
