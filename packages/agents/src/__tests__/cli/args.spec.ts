import type { ParsedRunArgs } from '../../cli/args';
import { AgentsArgsError, parseAgentsArgs, RUN_FLAGS, USAGE } from '../../cli/args';

/** Narrows `ParsedAgentsArgs` to its `run` case, for the `describe` block that only exercises that shape. */
function parseRun(argv: readonly string[]): ParsedRunArgs {
  const parsed = parseAgentsArgs(argv);
  if (parsed.kind !== 'run') {
    throw new Error(`expected kind "run", got "${parsed.kind}"`);
  }
  return parsed;
}

describe('parseAgentsArgs — help', () => {
  it.each([[[]], [['help']], [['--help']], [['-h']]])('recognizes %j as help', (argv) => {
    expect(parseAgentsArgs(argv)).toEqual({ kind: 'help' });
  });
});

describe('parseAgentsArgs — list', () => {
  it('parses list with no flags', () => {
    expect(parseAgentsArgs(['list'])).toEqual({ kind: 'list', agentsDir: undefined });
  });

  it('parses list --agents-dir', () => {
    expect(parseAgentsArgs(['list', '--agents-dir', '/somewhere'])).toEqual({ kind: 'list', agentsDir: '/somewhere' });
  });

  it('rejects a missing value for --agents-dir', () => {
    expect(() => parseAgentsArgs(['list', '--agents-dir'])).toThrow(/Missing value for --agents-dir/);
  });

  it('rejects any other flag for list', () => {
    expect(() => parseAgentsArgs(['list', '--bogus'])).toThrow(/Unknown argument "--bogus" for "list"/);
  });
});

describe('parseAgentsArgs — run', () => {
  it('parses a bare command with a multi-word task', () => {
    expect(parseAgentsArgs(['developer', 'fix', 'the', 'bug'])).toMatchObject({
      kind: 'run',
      command: 'developer',
      task: 'fix the bug',
      mode: undefined,
      colorize: true,
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
    expect(() => parseAgentsArgs(['developer', '--mode', 'bogus'])).toThrow(/--mode must be execute, plan or ask/);
  });

  it('rejects a missing value for --mode', () => {
    expect(() => parseAgentsArgs(['developer', '--mode'])).toThrow(/Missing value for --mode/);
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
      /Conflicting modes: execute and plan/,
    );
    expect(() => parseAgentsArgs(['developer', '--mode-ask', '--mode-plan'])).toThrow(/Conflicting modes: ask and plan/);
  });

  it('no longer accepts --plan', () => {
    expect(() => parseAgentsArgs(['developer', '--plan'])).toThrow(/unknown flag: --plan/);
  });

  it('--since-pending is --since pending, and conflicts with another --since', () => {
    expect(parseRun(['developer', '--since-pending']).since).toBe('pending');
    expect(parseRun(['developer', '--since', 'pending', '--since-pending']).since).toBe('pending');
    expect(() => parseAgentsArgs(['developer', '--since', 'HEAD~1', '--since-pending'])).toThrow(
      /Conflicting --since values: HEAD~1 and pending/,
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
      /Conflicting ticket types: bug and story/,
    );
    expect(() => parseAgentsArgs(['po', '--type-'])).toThrow(/Missing ticket type in --type-<type>/);
    expect(() => parseAgentsArgs(['po', '--type'])).toThrow(/Missing value for --type/);
    expect(() => parseAgentsArgs(['po', '--type-bug', '--ticket', 'red-3'])).toThrow(/use only one/);
  });

  it('rejects a missing value for --project', () => {
    expect(() => parseAgentsArgs(['developer', '--project'])).toThrow(/Missing value for --project/);
  });

  it('rejects a missing value for --plan-from', () => {
    expect(() => parseAgentsArgs(['developer', '--plan-from'])).toThrow(/Missing value for --plan-from/);
  });

  it('parses --provider and --model', () => {
    const parsed = parseAgentsArgs(['developer', '--provider', 'cursor', '--model', 'gpt-5']);

    expect(parsed).toMatchObject({ provider: 'cursor', model: 'gpt-5' });
  });

  it('rejects a missing value for --provider', () => {
    expect(() => parseAgentsArgs(['developer', '--provider'])).toThrow(/Missing value for --provider/);
  });

  it.each(['auto', 'claude', 'cursor'] as const)('accepts --%s as shorthand for --provider %s', (name) => {
    expect(parseRun(['developer', `--${name}`]).provider).toBe(name);
  });

  it('lets a later --claude/--cursor/--auto override an earlier --provider, same as any repeated flag', () => {
    expect(parseRun(['developer', '--provider', 'cursor', '--claude']).provider).toBe('claude');
  });

  it('rejects a missing value for --model', () => {
    expect(() => parseAgentsArgs(['developer', '--model'])).toThrow(/Missing value for --model/);
  });

  it('parses --agents-dir for run, same as for list', () => {
    expect(parseRun(['developer', '--agents-dir', '/elsewhere']).agentsDir).toBe('/elsewhere');
  });

  it('rejects a missing value for --agents-dir', () => {
    expect(() => parseAgentsArgs(['developer', '--agents-dir'])).toThrow(/Missing value for --agents-dir/);
  });

  it('collects every --add-dir, in order', () => {
    expect(parseRun(['developer', '--add-dir', '/a', '--add-dir', '/b']).addDirs).toEqual(['/a', '/b']);
  });

  it('rejects a missing value for --add-dir', () => {
    expect(() => parseAgentsArgs(['developer', '--add-dir'])).toThrow(/Missing value for --add-dir/);
  });

  it('parses --dry-run and --no-color', () => {
    const parsed = parseAgentsArgs(['developer', '--dry-run', '--no-color']);

    expect(parsed).toMatchObject({ dryRun: true, colorize: false });
  });

  it('parses --since', () => {
    expect(parseRun(['sync-docs', '--since', 'pending']).since).toBe('pending');
    expect(parseRun(['sync-docs', '--since', 'HEAD~1']).since).toBe('HEAD~1');
  });

  it('rejects a missing value for --since', () => {
    expect(() => parseAgentsArgs(['sync-docs', '--since'])).toThrow(/Missing value for --since/);
  });

  it('rejects an unrecognized flag', () => {
    expect(() => parseAgentsArgs(['developer', '--bogus'])).toThrow(
      "unknown flag: --bogus\n\nUsage:  agents developer [OPTIONS] [TASK...]\n\nRun 'agents developer --help' for more information",
    );
  });

  it('accepts flags interleaved with task words, in any order', () => {
    const parsed = parseAgentsArgs(['developer', 'fix', '--mode', 'ask', 'the', '--dry-run', 'bug']);

    expect(parsed).toMatchObject({ task: 'fix the bug', mode: 'ask', dryRun: true });
  });

  it('every error is an AgentsArgsError', () => {
    expect(() => parseAgentsArgs(['developer', '--bogus'])).toThrow(AgentsArgsError);
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
    expect(() => parseAgentsArgs(['--'])).toThrow(/Missing command/);
  });
});

describe('RUN_FLAGS', () => {
  it('lists only flags the parser accepts after a command name', () => {
    for (const flag of RUN_FLAGS) {
      const value = flag.name === '--mode' ? ['plan'] : flag.valueName === undefined ? [] : ['x'];
      for (const form of [flag.name, ...(flag.aliases ?? [])]) {
        expect(() => parseAgentsArgs(['echo', form, ...value])).not.toThrow();
      }
    }
  });

  it('points argument errors at --help', () => {
    expect(USAGE).toBe("Run 'agents --help' for usage.");
  });
});
