import { expect, test } from 'bun:test';

import { UsageError } from '../src/errors';
import { checkPlan, planPath } from '../scripts/plan';

/** A plan in the skill's format, with the approval and review lines given. */
function plan(
  approval = '- [] Aprovado',
  { review = '- [] Revisado', extra = '' } = {},
): string {
  return `# Um plano

## Contexto

Por quê.

## Decisões

- Uma.

## Fases

### Fase 1: fazer

- [ ] Um passo.
- [x] Outro, feito.

\`\`\`md
## Um modelo dentro de um bloco de código não conta
\`\`\`

### Fase 2: terminar

- [ ] O último passo.

${review}

## Skills a consultar

- nenhuma

## Verificação

- roda.

## Fora do escopo

- Nada será commitado: o commit é do usuário.
${extra}
## Aprovação

${approval}
`;
}

test('um plano no formato, ainda sem aprovação: formato certo, não aprovado nem revisado', () => {
  expect(checkPlan(plan())).toEqual({
    problems: [],
    approved: false,
    reviewed: false,
  });
});

test('com "- [x] Aprovado" (ou X) o plano está aprovado; com "- [x] Revisado", revisado', () => {
  expect(checkPlan(plan('- [x] Aprovado'))).toEqual({
    problems: [],
    approved: true,
    reviewed: false,
  });
  expect(checkPlan(plan('- [X] Aprovado')).approved).toBe(true);
  expect(
    checkPlan(plan('- [x] Aprovado', { review: '- [x] Revisado' })),
  ).toEqual({ problems: [], approved: true, reviewed: true });
});

test('uma linha de aprovação malformada é um problema, e o plano não está aprovado', () => {
  for (const line of ['- [ ] Aprovado', '- [x] aprovado', 'Aprovado', '']) {
    const { problems, approved } = checkPlan(plan(line));
    expect(approved).toBe(false);
    expect(problems).toEqual([
      'A seção "## Aprovação" deve ter só a linha "- [] Aprovado" (sem espaço entre os colchetes), ou "- [x] Aprovado" depois que o usuário aprovar.',
    ]);
  }
  // Two lines: also refused, even if one is marked.
  expect(
    checkPlan(plan('- [x] Aprovado\n- [] Aprovado')).problems,
  ).toHaveLength(1);
});

test('a revisão é a última linha das Fases, uma vez só, no formato certo', () => {
  const message =
    'A seção "## Fases" deve terminar, abaixo da última fase, com a linha "- [] Revisado" (uma vez só), que o usuário marca depois de revisar.';
  for (const review of [
    '',
    '- [ ] Revisado',
    'Revisado',
    '- [] Revisado\n\nTexto depois.',
  ]) {
    const { problems, reviewed } = checkPlan(
      plan('- [x] Aprovado', { review }),
    );
    expect(reviewed).toBe(false);
    expect(problems).toEqual([message]);
  }
  const twice = plan().replace(
    '- [ ] Um passo.',
    '- [] Revisado\n- [ ] Um passo.',
  );
  expect(checkPlan(twice).problems).toEqual([message]);
});

test('a revisão não conta como passo da última fase', () => {
  const onlyReview = plan().replace('- [ ] O último passo.', 'Só texto.');
  expect(checkPlan(onlyReview).problems).toEqual([
    'A "### Fase 2: terminar" não tem nenhum passo com checkbox ("- [ ] …").',
  ]);
});

test('o Fora do escopo diz que nada será commitado', () => {
  const committing = plan().replace(
    '- Nada será commitado: o commit é do usuário.',
    '- Outra coisa.',
  );
  expect(checkPlan(committing).problems).toEqual([
    'A seção "## Fora do escopo" deve dizer que nada será commitado: "- Nada será commitado: o commit é do usuário."',
  ]);
});

test('seção faltando, fora de ordem, ou a Aprovação que não é a última', () => {
  const missing = plan().replace('## Verificação\n\n- roda.\n', '');
  expect(checkPlan(missing).problems).toEqual([
    'Falta a seção "## Verificação".',
  ]);

  const swapped = plan()
    .replace('## Contexto', '## TEMP')
    .replace('## Decisões', '## Contexto')
    .replace('## TEMP', '## Decisões');
  expect(checkPlan(swapped).problems).toEqual([
    'As seções estão fora de ordem: a ordem é "Contexto", "Decisões", "Fases", "Skills a consultar", "Verificação", "Fora do escopo", "Aprovação".',
  ]);

  const after = `${plan('- [x] Aprovado')}\n## Notas\n\nDepois da aprovação.\n`;
  const { problems, approved } = checkPlan(after);
  expect(problems).toEqual([
    'A seção "## Aprovação" tem de ser a última do plano.',
  ]);
  expect(approved).toBe(true);
});

test('sem título, sem passos numa fase, sem a seção Aprovação', () => {
  expect(checkPlan(plan().replace('# Um plano', 'Um plano')).problems).toEqual([
    'A primeira linha deve ser o título: "# <título>".',
  ]);

  const noSteps = plan().replace(
    '- [ ] Um passo.\n- [x] Outro, feito.',
    'Só texto.',
  );
  expect(checkPlan(noSteps).problems).toEqual([
    'A "### Fase 1: fazer" não tem nenhum passo com checkbox ("- [ ] …").',
  ]);

  const noApproval = plan().replace('## Aprovação\n\n- [] Aprovado\n', '');
  expect(checkPlan(noApproval)).toEqual({
    problems: ['Falta a seção "## Aprovação".'],
    approved: false,
    reviewed: false,
  });
});

test('planPath aceita só um .md dentro de plans/', () => {
  expect(planPath('plans/x.md', '/projeto')).toBe('/projeto/plans/x.md');
  expect(planPath('/projeto/plans/sub/y.md', '/projeto')).toBe(
    '/projeto/plans/sub/y.md',
  );
  for (const path of ['README.md', 'plans/x.txt', '../plans/x.md', 'plans']) {
    expect(() => planPath(path, '/projeto')).toThrow(UsageError);
  }
  expect(() => planPath('README.md', '/projeto')).toThrow(
    'README.md não é um plano',
  );
});
