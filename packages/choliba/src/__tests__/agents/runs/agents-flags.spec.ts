import { join } from 'node:path';

import type { ParsedRunArgs } from '../../../agents/agents/runs/agents-flags';
import {
  AgentsArgsError,
  parseAgentsArgs as parseWith,
  parseListArgs,
  runFlagDefinitions,
  USAGE,
} from '../../../agents/agents/runs/agents-flags';
import {
  agentFlagNames,
  loadAgent,
  modeDescription,
  PROJECT_FLAGS,
  sinceDescription,
  TICKET_FLAGS,
} from '../../../agents';
import { PROVIDERS } from '../../helpers/providers';

const parseAgentsArgs = (argv: readonly string[]): ReturnType<typeof parseWith> => parseWith(argv, PROVIDERS);
const RUN_FLAGS = runFlagDefinitions(PROVIDERS);
const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'agents');

/** Narrows `ParsedAgentsArgs` to its `run` case, for the `describe` block that only exercises that shape. */
function parseRun(argv: readonly string[]): ParsedRunArgs {
  const parsed = parseAgentsArgs(argv);
  if (parsed.kind !== 'run') {
    throw new Error(`expected kind "run", got "${parsed.kind}"`);
  }
  return parsed;
}

describe('agents CLI flag exports', () => {
  it('keeps the descriptions and agent-specific flag groups available', () => {
    expect(modeDescription('plan')).toBe('Modo de execução (padrão: plan):');
    expect(sinceDescription('develop')).toContain('(padrão: develop)');
    expect(PROJECT_FLAGS).toEqual(['--project']);
    expect(TICKET_FLAGS).toEqual(['--type', '--ticket']);
  });

  it('lists the accepted flags and aliases for an agent', () => {
    const names = agentFlagNames(loadAgent(FIXTURES, 'echo'), PROVIDERS);

    expect(names).toContain('--dry-run');
    expect(names).toContain('--help');
    expect(names).toContain('-h');
    expect(names).not.toContain('--project');
  });
});

describe('parseAgentsArgs — help', () => {
  it.each([[[]], [['help']], [['--help']], [['-h']]])('recognizes %j as help', (argv) => {
    expect(parseAgentsArgs(argv)).toEqual({ kind: 'help' });
  });
});

describe('parseListArgs', () => {
  it('parses list agents with no flags, with --agents-dir and with --help', () => {
    expect(parseListArgs([])).toEqual({ kind: 'list', agentsDir: undefined });
    expect(parseListArgs(['--agents-dir', '/somewhere'])).toEqual({ kind: 'list', agentsDir: '/somewhere' });
    expect(parseListArgs(['-h'])).toEqual({ kind: 'help' });
    expect(parseListArgs(['--agents-dir', '/x', '--help'])).toEqual({ kind: 'help' });
  });

  it('rejects a missing value for --agents-dir', () => {
    expect(() => parseListArgs(['--agents-dir'])).toThrow(/falta um valor para --agents-dir/);
  });

  it('rejects any other flag', () => {
    expect(() => parseListArgs(['--bogus'])).toThrow(
      "opção desconhecida: --bogus.\nRun 'choliba list agents --help' for usage.",
    );
    expect(() => parseListArgs(['--agent-dir'])).toThrow('Você quis dizer "--agents-dir"?');
  });

  it('takes list as an agent name under run agent', () => {
    expect(parseAgentsArgs(['list'])).toMatchObject({ kind: 'run', command: 'list' });
  });
});

describe('parseAgentsArgs — run', () => {
  it('parses a bare command with a multi-word task', () => {
    expect(parseAgentsArgs(['developer', 'fix', 'the', 'bug'])).toMatchObject({
      kind: 'run',
      command: 'developer',
      task: 'fix the bug',
      mode: undefined,
      dryRun: false,
      addDirs: [],
    });
  });

  it('parses a command with no task', () => {
    expect(parseAgentsArgs(['developer'])).toMatchObject({ command: 'developer', task: '' });
  });

  it('defaults help to false', () => {
    expect(parseRun(['developer']).help).toBe(false);
  });

  it.each(['--help', '-h'] as const)('recognizes %s after the command as per-agent help, not global help', (flag) => {
    expect(parseAgentsArgs(['--sync-docs', flag])).toMatchObject({
      kind: 'run',
      command: 'sync-docs',
      help: true,
    });
  });

  it('--help works alongside other flags, in any position', () => {
    expect(parseRun(['developer', '--help', '--agents-dir', '/x']).help).toBe(true);
  });

  it.each(['execute', 'plan', 'ask'] as const)('accepts --mode %s', (mode) => {
    expect(parseRun(['developer', '--mode', mode]).mode).toBe(mode);
  });

  it('rejects an invalid --mode value', () => {
    expect(() => parseAgentsArgs(['developer', '--mode', 'bogus'])).toThrow(/--mode precisa ser execute, plan ou ask/);
  });

  it('rejects a missing value for --mode', () => {
    expect(() => parseAgentsArgs(['developer', '--mode'])).toThrow(/falta um valor para --mode/);
  });

  it('--mode-<mode> sets the mode', () => {
    expect(parseRun(['developer', '--mode-execute']).mode).toBe('execute');
    expect(parseRun(['developer', '--mode-plan']).mode).toBe('plan');
    expect(parseRun(['developer', '--mode-ask']).mode).toBe('ask');
  });

  it('accepts the same mode twice, from --mode and its shortcut', () => {
    expect(parseRun(['developer', '--mode', 'plan', '--mode-plan']).mode).toBe('plan');
  });

  it('rejects two different modes', () => {
    expect(() => parseAgentsArgs(['developer', '--mode', 'execute', '--mode-plan'])).toThrow(
      /modos conflitantes: execute e plan/,
    );
    expect(() => parseAgentsArgs(['developer', '--mode-ask', '--mode-plan'])).toThrow(/modos conflitantes: ask e plan/);
  });

  it('refuses a flag no agent takes, --plan included (the mode is --mode plan or --mode-plan)', () => {
    expect(() => parseAgentsArgs(['developer', '--plan'])).toThrow(/opção desconhecida: --plan/);
    expect(() => parseAgentsArgs(['developer', '--red'])).toThrow(/opção desconhecida: --red/);
    expect(() => parseAgentsArgs(['developer', '--Plan'])).toThrow(/opção desconhecida: --Plan/);
  });

  it('--since-pending is --since pending, and conflicts with another --since', () => {
    expect(parseRun(['developer', '--since-pending']).since).toBe('pending');
    expect(parseRun(['developer', '--since', 'pending', '--since-pending']).since).toBe('pending');
    expect(() => parseAgentsArgs(['developer', '--since', 'HEAD~1', '--since-pending'])).toThrow(
      /valores de --since conflitantes: HEAD~1 e pending/,
    );
  });

  it('parses --plan-from', () => {
    expect(parseRun(['developer', '--plan-from', 'plans/developer/x.md']).planFrom).toBe('plans/developer/x.md');
  });

  it('parses --project, leaving it out of the task', () => {
    const parsed = parseRun(['product-owner', '--project', 'red', 'login', 'quebrado']);
    expect(parsed.project).toBe('red');
    expect(parsed.task).toBe('login quebrado');
    expect(parseRun(['developer']).project).toBeUndefined();
  });

  it('parses --type, its --type-<type> shortcut for any type, and --ticket', () => {
    expect(parseRun(['po', '--type', 'bug', 'x'])).toMatchObject({ ticketType: 'bug', ticket: undefined, task: 'x' });
    expect(parseRun(['po', '--type-improvement']).ticketType).toBe('improvement');
    expect(parseRun(['po', '--type-bug', '--type', 'bug']).ticketType).toBe('bug');
    expect(parseRun(['po', '--ticket', 'red-3']).ticket).toBe('red-3');
    expect(parseRun(['po']).ticketType).toBeUndefined();
  });

  it('rejects two ticket types, an empty shortcut, and --type together with --ticket', () => {
    expect(() => parseAgentsArgs(['po', '--type-bug', '--type', 'story'])).toThrow(
      /tipos de ticket conflitantes: bug e story/,
    );
    expect(() => parseAgentsArgs(['po', '--type-'])).toThrow(/falta o tipo de ticket em --type-<tipo>/);
    expect(() => parseAgentsArgs(['po', '--type'])).toThrow(/falta um valor para --type/);
    expect(() => parseAgentsArgs(['po', '--type-bug', '--ticket', 'red-3'])).toThrow(/use apenas um/);
  });

  it('rejects a missing value for --project', () => {
    expect(() => parseAgentsArgs(['developer', '--project'])).toThrow(/falta um valor para --project/);
  });

  it('rejects a missing value for --plan-from', () => {
    expect(() => parseAgentsArgs(['developer', '--plan-from'])).toThrow(/falta um valor para --plan-from/);
  });

  it('parses --provider and --model', () => {
    const parsed = parseAgentsArgs(['developer', '--provider', 'cursor', '--model', 'gpt-5']);

    expect(parsed).toMatchObject({ provider: 'cursor', model: 'gpt-5' });
  });

  it('rejects a missing value for --provider', () => {
    expect(() => parseAgentsArgs(['developer', '--provider'])).toThrow(/falta um valor para --provider/);
  });

  it.each(['auto', 'claude', 'codex', 'cursor'] as const)('accepts --%s as shorthand for --provider %s', (name) => {
    expect(parseRun(['developer', `--${name}`]).provider).toBe(name);
  });

  it('lets a later --claude/--cursor/--auto override an earlier --provider, same as any repeated flag', () => {
    expect(parseRun(['developer', '--provider', 'cursor', '--claude']).provider).toBe('claude');
  });

  it('rejects a missing value for --model', () => {
    expect(() => parseAgentsArgs(['developer', '--model'])).toThrow(/falta um valor para --model/);
  });

  it('parses --agents-dir for run, same as for list', () => {
    expect(parseRun(['developer', '--agents-dir', '/elsewhere']).agentsDir).toBe('/elsewhere');
  });

  it('rejects a missing value for --agents-dir', () => {
    expect(() => parseAgentsArgs(['developer', '--agents-dir'])).toThrow(/falta um valor para --agents-dir/);
  });

  it('collects every --add-dir, in order', () => {
    expect(parseRun(['developer', '--add-dir', '/a', '--add-dir', '/b']).addDirs).toEqual(['/a', '/b']);
  });

  it('rejects a missing value for --add-dir', () => {
    expect(() => parseAgentsArgs(['developer', '--add-dir'])).toThrow(/falta um valor para --add-dir/);
  });

  it('parses --dry-run, and leaves --no-color to choliba (a global flag, removed before any command)', () => {
    expect(() => parseAgentsArgs(['developer', '--no-color'])).toThrow(AgentsArgsError);
    const parsed = parseAgentsArgs(['developer', '--dry-run']);

    expect(parsed).toMatchObject({ dryRun: true });
  });

  it('parses --since', () => {
    expect(parseRun(['sync-docs', '--since', 'pending']).since).toBe('pending');
    expect(parseRun(['sync-docs', '--since', 'HEAD~1']).since).toBe('HEAD~1');
  });

  it('rejects a missing value for --since', () => {
    expect(() => parseAgentsArgs(['sync-docs', '--since'])).toThrow(/falta um valor para --since/);
  });

  it('rejects an unrecognized flag', () => {
    expect(() => parseAgentsArgs(['developer', '--bogus=1'])).toThrow(
      "opção desconhecida: --bogus=1.\n\nUsage:  choliba run agent developer [OPTIONS] [TASK...]\n\nRun 'choliba run agent developer --help' for usage.",
    );
  });

  it('suggests the closest flag', () => {
    expect(() => parseAgentsArgs(['developer', '--dry-rn'])).toThrow(
      'opção desconhecida: --dry-rn. Você quis dizer "--dry-run"?',
    );
  });

  it('accepts flags interleaved with task words, in any order', () => {
    const parsed = parseAgentsArgs(['developer', 'fix', '--mode', 'ask', 'the', '--dry-run', 'bug']);

    expect(parsed).toMatchObject({ task: 'fix the bug', mode: 'ask', dryRun: true });
  });

  it('every error is an AgentsArgsError', () => {
    expect(() => parseAgentsArgs(['developer', '--bogus=1'])).toThrow(AgentsArgsError);
  });

  it('accepts --<command> as an alternative to the positional command', () => {
    expect(parseAgentsArgs(['--sync-docs'])).toMatchObject({ kind: 'run', command: 'sync-docs', task: '' });
  });

  it('accepts flags after --<command>', () => {
    expect(parseRun(['--sync-docs', '--since', 'HEAD~1'])).toMatchObject({
      command: 'sync-docs',
      since: 'HEAD~1',
    });
  });

  it('accepts task words after --<command>', () => {
    expect(parseRun(['--developer', 'fix', 'the', 'bug'])).toMatchObject({
      command: 'developer',
      task: 'fix the bug',
    });
  });

  it('rejects a bare "--" with no command name after it', () => {
    expect(() => parseAgentsArgs(['--'])).toThrow(/falta o agente/);
  });
});

describe('RUN_FLAGS', () => {
  it('lists only flags the parser accepts after a command name', () => {
    for (const flag of RUN_FLAGS) {
      // A flag with choices takes one of them (--mode, --sandbox); any other value flag takes any word.
      const choice = flag.choices?.[0]?.name;
      const value = choice !== undefined ? [choice] : flag.valueName === undefined ? [] : ['x'];
      // --show-prompt only makes sense with --dry-run, which it needs.
      const needs = flag.name === '--show-prompt' ? ['--dry-run'] : [];
      for (const form of [flag.name, ...(flag.aliases ?? [])]) {
        expect(() => parseAgentsArgs(['echo', form, ...value, ...needs])).not.toThrow();
      }
    }
  });

  it('takes --show-prompt only together with --dry-run', () => {
    expect(parseRun(['echo', '--dry-run', '--show-prompt'])).toMatchObject({ dryRun: true, showPrompt: true });
    expect(parseRun(['echo', '--dry-run'])).toMatchObject({ dryRun: true, showPrompt: false });
    expect(() => parseAgentsArgs(['echo', '--show-prompt'])).toThrow(
      new AgentsArgsError(`--show-prompt só funciona com --dry-run. ${USAGE}`),
    );
  });

  it('points argument errors at --help', () => {
    expect(USAGE).toBe("Run 'choliba run agent --help' for usage.");
  });
});
