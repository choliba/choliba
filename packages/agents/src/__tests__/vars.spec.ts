import { join } from 'node:path';

import type { AgentDefinition, AgentModeSteps } from '../agent.types';
import { loadAgent } from '../agent-loader';
import { readAgentPermissions } from '../permissions';
import {
  AGENT_VARS,
  AgentVarsError,
  agentTexts,
  expandExitCode,
  expandVars,
  varNames,
  varProblems,
  withExpandedVars,
} from '../vars';

const FIXTURES = join(__dirname, 'fixtures', 'agents');

const NO_STEPS: AgentModeSteps = { before: [], after: { success: [], failure: [], always: [] } };

/** The `echo` fixture with `changes` on top: a declaration whose texts a test chooses. */
function echoWith(changes: Partial<AgentDefinition>): AgentDefinition {
  return { ...loadAgent(FIXTURES, 'echo'), ...changes };
}

function stepsIn(execute: AgentModeSteps): AgentDefinition['steps'] {
  return { execute, plan: NO_STEPS, ask: NO_STEPS };
}

describe('expandVars', () => {
  it('replaces each known ${NAME} and lists the unknown ones once', () => {
    expect(expandVars('${A}/x/${B}/${A} ${C} ${C} $A ${lower}', { A: '/a', B: 'b' })).toEqual({
      text: '/a/x/b//a ${C} ${C} $A ${lower}',
      missing: ['C'],
    });
  });
});

describe('varNames', () => {
  it('lists every ${NAME} in order, as often as it appears', () => {
    expect(varNames('${A} e ${B}/${A} $C ${lower}')).toEqual(['A', 'B', 'A']);
  });
});

describe('AGENT_VARS', () => {
  it('is the catalog of the README', () => {
    expect(AGENT_VARS).toEqual([
      'CHOL_ROOT',
      'CHOL_AGENTS_DIR',
      'CHOL_SKILLS_DIR',
      'CHOL_MCPS_DIR',
      'CHOL_GLOBAL_DIR',
      'CHOL_PROJECTS_DIR',
      'CHOL_TICKET_RUNS',
      'PROJECT',
      'PROJECT_DIR',
      'APP_DIR',
      'TICKET',
      'TICKET_FILE',
      'AGENT_EXIT_CODE',
    ]);
  });
});

describe('agentTexts', () => {
  it('lists every text that may hold ${NAME}: sections, instructions, permissions and step arguments', () => {
    const agent = echoWith({
      sections: { role: 'r', context: ['c'], input: 'i', flow: 'f', output: 'o', notes: ['n'] },
      skills: [{ name: 's', instructions: 'si' }, { name: 'bare' }],
      mcps: [{ name: 'm', instructions: 'mi' }],
      permissions: readAgentPermissions({ allow: { read: ['pr'] } }),
      steps: {
        execute: {
          before: [{ action: 'run', args: ['b'] }],
          after: { success: [{ action: 'run', args: ['s'] }], failure: [], always: [] },
        },
        plan: NO_STEPS,
        ask: { before: [], after: { success: [], failure: [{ action: 'run', args: ['f'] }], always: [] } },
      },
    });

    expect(agentTexts(agent)).toEqual(['r', 'c', 'i', 'f', 'o', 'n', 'si', 'mi', 'pr', 'b', 's', 'f']);
  });
});

describe('varProblems', () => {
  it('accepts the catalog, and AGENT_EXIT_CODE in the after steps', () => {
    const agent = echoWith({
      sections: { ...loadAgent(FIXTURES, 'echo').sections, role: '${PROJECT} em ${CHOL_ROOT}' },
      steps: stepsIn({
        before: [],
        after: { success: [], failure: [{ action: 'run', args: ['x', '${AGENT_EXIT_CODE}'] }], always: [] },
      }),
    });

    expect(varProblems(agent)).toEqual([]);
  });

  it('names a variable outside the catalog, and AGENT_EXIT_CODE outside the after steps, once each', () => {
    const agent = echoWith({
      mcps: [{ name: 'm', instructions: '${NOPE} ${NOPE}' }],
      steps: stepsIn({ before: [{ action: 'run', args: ['${AGENT_EXIT_CODE}'] }], after: NO_STEPS.after }),
    });

    expect(varProblems(agent)).toEqual([
      expect.stringMatching(
        /^\$\{NOPE\} \(em mcps\.m\.instructions\) não é uma variável do agent\.yaml; as que existem: CHOL_ROOT, /,
      ),
      '${AGENT_EXIT_CODE} só vale em steps.<modo>.after (está em steps.execute.before)',
    ]);
  });
});

describe('withExpandedVars', () => {
  it('leaves an agent without variables untouched, never loading them', () => {
    const agent = loadAgent(FIXTURES, 'echo');
    const loadVars = jest.fn(() => ({}));

    expect(withExpandedVars(agent, loadVars)).toBe(agent);
    expect(loadVars).not.toHaveBeenCalled();
  });

  it('fills in the variables of the text and of the permissions, and can do so more than once', () => {
    const agent = loadAgent(FIXTURES, 'with-vars');

    for (const root of ['/p1', '/p2']) {
      const expanded = withExpandedVars(agent, () => ({ CHOL_PROJECTS_DIR: root }));
      expect(expanded.sections.role).toBe(`Fixture de teste: grava tickets em ${root}.\n`);
      expect(expanded.permissions.allowWrite).toEqual([`${root}/*/tickets/`]);
      expect(expanded.permissions.allowRead).toEqual([`${root}/*/config.json`]);
    }
  });

  it('fills in the directories and commands of execute, and the instructions of skills and MCPs', () => {
    const agent = echoWith({
      skills: [{ name: 's', instructions: 'Em ${CHOL_ROOT}.' }],
      mcps: [{ name: 'm', instructions: 'Projeto ${PROJECT}.' }],
      permissions: readAgentPermissions({ allow: { execute: { '${CHOL_ROOT}/': ['bunx choliba tests ${PROJECT}'] } } }),
    });

    const expanded = withExpandedVars(agent, () => ({ CHOL_ROOT: '/w', PROJECT: 'demo' }));

    expect(expanded.permissions.allowExecute).toEqual([{ dir: '/w/', commands: ['bunx choliba tests demo'] }]);
    expect(expanded.skills).toEqual([{ name: 's', instructions: 'Em /w.' }]);
    expect(expanded.mcps).toEqual([{ name: 'm', instructions: 'Projeto demo.' }]);
  });

  it('fills in the arguments of every step, keeping ${AGENT_EXIT_CODE} for after the agent', () => {
    const agent = echoWith({
      steps: stepsIn({
        before: [{ action: 'add_files', args: ['falhas', '.cache/${TICKET}.md'] }],
        after: {
          success: [{ action: 'run', args: ['bunx', 'choliba', 'tests', '${PROJECT}:${TICKET}'] }],
          failure: [{ action: 'run', args: ['report', '${TICKET}', '${AGENT_EXIT_CODE}'] }],
          always: [],
        },
      }),
    });

    const expanded = withExpandedVars(agent, () => ({ PROJECT: 'demo', TICKET: 'demo-2' }));

    expect(expanded.steps.execute).toEqual({
      before: [{ action: 'add_files', args: ['falhas', '.cache/demo-2.md'] }],
      after: {
        success: [{ action: 'run', args: ['bunx', 'choliba', 'tests', 'demo:demo-2'] }],
        failure: [{ action: 'run', args: ['report', 'demo-2', '${AGENT_EXIT_CODE}'] }],
        always: [],
      },
    });
  });

  it('stops naming agent.yaml, the missing variables and the available ones', () => {
    const agent = loadAgent(FIXTURES, 'with-vars');

    expect(() => withExpandedVars(agent, () => ({ CHOL_GLOBAL_DIR: '/g' }))).toThrow(AgentVarsError);
    expect(() => withExpandedVars(agent, () => ({ CHOL_GLOBAL_DIR: '/g' }))).toThrow(
      `${agent.sourcePath} usa \${CHOL_PROJECTS_DIR}, sem valor (disponíveis: CHOL_GLOBAL_DIR).`,
    );
  });
});

describe('expandExitCode', () => {
  it('fills in ${AGENT_EXIT_CODE} and leaves the rest as it is', () => {
    expect(expandExitCode([{ action: 'run', args: ['report', '${AGENT_EXIT_CODE}', '${OTHER}'] }], 3)).toEqual([
      { action: 'run', args: ['report', '3', '${OTHER}'] },
    ]);
  });
});
