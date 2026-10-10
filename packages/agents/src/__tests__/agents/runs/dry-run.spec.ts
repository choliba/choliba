import { COMMAND_LINE_TITLE, formatDryRun, type DryRunInput } from '../../../agents/runs/dry-run';
import { wrapInstructions } from '../../../common/prompt';
import type { ProviderRequest } from '../../../common/interfaces/provider.interface';
import { NO_MODE_STEPS, NO_STEPS, fakeSections } from '../../helpers/agent';
import { NO_PERMISSIONS } from '../../../common/agent-permissions';

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    agent: {
      name: 'echo',
      id: 'echo',
      displayName: 'Echo',
      version: '1.0.0',
      description: 'd',
      supportedModels: [],
      skills: [],
      mcps: [],
      policy: 'read-only',
      taskRequired: true,
      projectRequired: false,
      allowWithoutTicket: false,
      defaultMode: 'execute',
      modes: ['execute', 'plan', 'ask'],
      permissions: NO_PERMISSIONS,
      steps: NO_MODE_STEPS,
      sections: fakeSections('be an echo'),
      dir: '/repo/agents/echo',
      sourcePath: '/repo/agents/echo/agent.yaml',
    },
    mode: 'execute',
    policy: 'read-only',
    userPrompt: 'Task:\ndo it',
    workspaceRoot: '/repo',
    runDir: '/repo/.cache/runs/1',
    addDirs: [],
    model: undefined,
    ...overrides,
  };
}

function input(overrides: Partial<DryRunInput> = {}): DryRunInput {
  return {
    providerId: 'claude',
    command: ['claude'],
    args: ['-p', 'Task:\ndo it', '--tools', 'Read,Grep'],
    request: request(),
    newTicket: undefined,
    hasTicket: false,
    showPrompt: false,
    workspaceFiles: [],
    ...overrides,
  };
}

describe('formatDryRun', () => {
  it('lists, in order, what the CLI and the agent would do, without the prompts', () => {
    expect(formatDryRun(input()).split('\n')).toEqual([
      'Sem --dry-run, faria nesta ordem:',
      '',
      ' 1. [CLI]    execute.before: nada',
      ' 2. [agente] claude · modelo padrão do provider · modo execute · na pasta /repo/.cache/runs/1',
      '             skills: nenhuma · MCPs: nenhum',
      expect.stringMatching(
        /^ {13}prompt de sistema: \d+ bytes · prompt do usuário: 11 bytes \(--show-prompt mostra os dois\)$/,
      ),
      '             comando: claude -p <prompt do usuário> --tools Read,Grep',
      ' 3. [CLI]    execute.after.success (se o agente sair com 0): nada',
      '             execute.after.failure (se o agente falhar): nada',
      '             execute.after.always: nada',
    ]);
  });

  it("starts with the project's application: its setup, then starting it or stopping when it cannot be", () => {
    const withStart = formatDryRun(
      input({
        app: { baseURL: 'http://localhost:3000', setup: ['bun install', 'bun run build'], start: 'bun run dev' },
      }),
    ).split('\n');
    expect(withStart.slice(2, 4)).toEqual([
      ' 1. [CLI]    roda o setup: bun install, bun run build',
      '             sobe a aplicação com "bun run dev" se http://localhost:3000 não responder, e a derruba no fim',
    ]);
    expect(withStart[4]).toBe(' 2. [CLI]    execute.before: nada');

    expect(formatDryRun(input({ app: { baseURL: 'http://localhost:3000' } })).split('\n')[2]).toBe(
      ' 1. [CLI]    confere http://localhost:3000: sem resposta, para aqui (o ambiente não tem envs[].start)',
    );
  });

  it('shows each step, the ticket it creates and closes, the skills, the MCPs and the model', () => {
    const agent = {
      ...request().agent,
      skills: [{ name: 'playwright-cli' }, { name: 'trace' }],
      mcps: [{ name: 'issues', tools: ['a', 'b'] }, { name: 'docs' }],
      steps: {
        ...NO_MODE_STEPS,
        plan: {
          before: [{ action: 'run', args: ['bunx', 'choliba', 'tests', 'x'] }],
          after: { ...NO_STEPS.after, always: [{ action: 'run', args: ['rm', '-f', 'd.patch'] }] },
        },
      },
    };
    const text = formatDryRun(
      input({
        request: request({ agent, mode: 'plan', model: 'claude-sonnet-5' }),
        newTicket: '/p/tickets/1.json',
        hasTicket: true,
      }),
    );

    expect(text).toContain(
      ' 1. [CLI]    plan.before 1/1 — run: bunx choliba tests x\n             se falhar: para aqui, o agente não roda',
    );
    expect(text).toContain(' 2. [CLI]    cria o ticket /p/tickets/1.json');
    expect(text).toContain('claude · modelo claude-sonnet-5 · modo plan');
    expect(text).toContain('skills: playwright-cli, trace · MCPs: issues (2 tools), docs (todas as tools)');
    expect(text).toContain('             plan.after.always:\n               1/1 run: rm -f d.patch');
    expect(text).toContain(' 5. [CLI]    fecha o ticket:');
  });

  it('names the prompts on the command line, shows long arguments by size and quotes those with spaces', () => {
    const system = wrapInstructions(request().agent, undefined, { runDir: '/repo/.cache/runs/1', root: '/repo' });
    const text = formatDryRun(
      input({
        providerId: 'cursor',
        command: ['cursor', 'agent'],
        args: [
          '-p',
          `${system}\n\nTask:\ndo it`,
          '--append',
          system,
          '--mcp-config',
          'x'.repeat(250),
          '--add-dir',
          'a b',
        ],
      }),
    );

    expect(text).toContain(
      'comando: cursor agent -p <prompt de sistema + prompt do usuário> --append <prompt de sistema> --mcp-config <250 bytes> --add-dir "a b"',
    );
  });

  it('adds the prompts, the command line and the files of the provider in full with --show-prompt', () => {
    const args = ['-p', 'Task:\ndo it'];
    const text = formatDryRun(
      input({ args, showPrompt: true, workspaceFiles: [{ path: '/repo/.cursor/cli.json', content: '{}\n' }] }),
    );
    const sections = text.split('\n\n── ');

    expect(sections[0]).not.toContain('--show-prompt mostra');
    expect(sections[1]).toMatch(/^prompt de sistema ──\n<agent_instructions /);
    expect(sections[2]).toBe('prompt do usuário ──\nTask:\ndo it');
    expect(sections[3]).toBe(`${COMMAND_LINE_TITLE} ──\n["claude","-p","Task:\\ndo it"]`);
    expect(sections[4]).toBe('/repo/.cursor/cli.json ──\n{}');
  });
});
