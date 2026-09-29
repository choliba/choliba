import { join } from 'node:path';

import { complete, formatHelp } from '@choliba/core/cli';
import type { GitRunner } from '@choliba/core/git';

import { loadAgent } from '../../agent-loader';
import { agentCommandSpec, agentsCliSpec, flagValueSuggestions } from '../../cli/cli-spec';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');
const git: GitRunner = { run: () => ({ stdout: '', stderr: '', status: 0 }) };

describe('agentsCliSpec', () => {
  it('shows only the first sentence of an agent description in the help', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const agent = { ...echo, description: 'Primeira frase.   Segunda\n frase.' };

    const help = formatHelp(
      agentsCliSpec({ agents: [agent], repoRoot: '/repo', git, projects: () => [], tickets: () => [] }),
    );

    expect(help).toContain('  echo   Primeira frase.\n');
    expect(help).not.toContain('Segunda');
  });

  it('completes providers and asks for files for directory flags', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const spec = agentsCliSpec({ agents: [echo], repoRoot: '/repo', git, projects: () => [], tickets: () => [] });

    expect(complete(spec, ['echo', '--provider', ''])).toEqual({
      kind: 'values',
      values: ['auto', 'claude', 'cursor'],
    });
    expect(complete(spec, ['echo', '--agents-dir', ''])).toEqual({ kind: 'files' });
    expect(complete(spec, ['echo', '--add-dir', ''])).toEqual({ kind: 'files' });
    expect(complete(spec, ['list', '--agents-dir', ''])).toEqual({ kind: 'files' });
    expect(complete(spec, ['echo', '--model', 'g'])).toEqual({ kind: 'values', values: ['gpt-4o'] });
    expect(complete(spec, ['echo', '--help', '--'])).toEqual({ kind: 'values', values: [] });
    expect(complete(spec, ['-h', ''])).toEqual({ kind: 'values', values: [] });
  });

  it('suggests nothing for a flag without known values', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    expect(
      flagValueSuggestions('--unknown', echo, {
        agents: [],
        repoRoot: '/repo',
        git,
        projects: () => [],
        tickets: () => [],
      }),
    ).toEqual({
      kind: 'values',
      values: [],
    });
  });

  it("shows each agent's own defaults and hides diff-base flags without prepare", async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const prepared = await loadAgent(FIXTURES, 'with-prepare');
    const context = { agents: [echo, prepared], repoRoot: '/repo', git, projects: () => [], tickets: () => [] };

    const withPrepare = formatHelp(agentCommandSpec(prepared, context));
    const flat = withPrepare.replace(/\s+/g, ' ');
    expect(flat).toContain('--since ref Base do diff: pending (desde a última execução registrada), HEAD~N');
    expect(flat).toContain('tag ou SHA (padrão: develop)');
    expect(withPrepare).toContain('--since-pending');
    expect(withPrepare).toContain('(padrão: execute)');

    const withoutPrepare = formatHelp(agentCommandSpec(echo, context));
    expect(withoutPrepare).not.toContain('--since');
    expect(withoutPrepare).toContain('--mode-plan');
  });

  it('offers --project, completed with the project names, only to agents that require a project', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const withProject = await loadAgent(FIXTURES, 'with-project');
    const context = {
      agents: [echo, withProject],
      repoRoot: '/repo',
      git,
      projects: () => ['blue', 'red'],
      tickets: () => ['red-1', 'red-2'],
    };
    const spec = agentsCliSpec(context);

    expect(formatHelp(agentCommandSpec(withProject, context))).toContain('--project name');
    expect(formatHelp(agentCommandSpec(echo, context))).not.toContain('--project');
    expect(complete(spec, ['with-project', '--project', ''])).toEqual({ kind: 'values', values: ['blue', 'red'] });
  });

  it('offers --type, a --type-<type> per ticket type and --ticket only to agents with ticket_types', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const withTickets = { ...(await loadAgent(FIXTURES, 'with-project')), ticketTypes: ['bug', 'story'] };
    const context = {
      agents: [echo, withTickets],
      repoRoot: '/repo',
      git,
      projects: () => ['red'],
      tickets: () => ['red-1', 'red-2'],
    };
    const spec = agentsCliSpec(context);

    const help = formatHelp(agentCommandSpec(withTickets, context));
    expect(help).toContain('--type type');
    const flat = help.replace(/\s+/g, ' ');
    expect(flat).toContain('--type type Tipo do ticket novo, criado pelo CLI a partir do template do tipo:');
    expect(flat).toContain('bug Correção de falha: a aplicação faz algo diferente do esperado.');
    expect(flat).toMatch(/--type-bug Atalho para --type bug --type-story Atalho para --type story/);
    expect(help).toContain('--ticket key');
    const echoHelp = formatHelp(agentCommandSpec(echo, context));
    expect(echoHelp).not.toContain('--type');
    expect(echoHelp).not.toContain('--ticket');
    expect(complete(spec, ['with-project', '--type', ''])).toEqual({ kind: 'values', values: ['bug', 'story'] });
    expect(complete(spec, ['with-project', '--ticket', ''])).toEqual({ kind: 'values', values: ['red-1', 'red-2'] });
    expect(flagValueSuggestions('--type', echo, context)).toEqual({ kind: 'values', values: [] });

    const unknown = formatHelp(agentCommandSpec({ ...withTickets, ticketTypes: ['nope'] }, context));
    expect(unknown.replace(/\s+/g, ' ')).toContain('nope Tipo sem template em packages/projects/templates/ticket/.');
  });
});
