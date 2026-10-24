import { type AgentDefinition, readAgentPermissions } from '@choliba/domain';
import type { ProviderRequest } from '../../ports/provider.interface';
import { commandRules, commandViolation, type CommandRules } from '../../guards/command-guard';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';

function request(permissions: unknown): ProviderRequest {
  const agent: AgentDefinition = {
    name: 'implementer',
    id: 'implementer',
    displayName: 'Implementer',
    version: '1.0.0',
    description: 'implements',
    providers: [{ id: 'codex', models: ['gpt-6.1-sol'] }],
    skills: [],
    mcps: [],
    policy: 'edits',
    taskRequired: true,
    projectRequired: false,
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute'],
    permissions: readAgentPermissions(permissions),
    dir: '/repo/agents/implementer',
    sections: fakeSections('implement'),
    steps: NO_MODE_STEPS,
    sourcePath: '/repo/agents/implementer/agent.yaml',
  };
  return {
    agent,
    mode: 'execute',
    policy: 'edits',
    userPrompt: 'do it',
    workspaceRoot: '/repo',
    runDir: '/repo/.cache/runs/x',
    addDirs: [],
    model: 'gpt-6.1-sol',
  };
}

const RULES: CommandRules = {
  allowed: ['bun run test', 'git status'],
  denied: ['git push'],
  closedDirs: ['/repo/secret'],
  cwd: '/repo/.cache/runs/x',
};

describe('commandRules', () => {
  it("takes the agent's execute rules, as Claude would, and the run tools it allows", () => {
    const rules = commandRules(
      request({
        allow: { execute: { './': ['bun run test', 'git'] }, tools: { ask: ['*'] } },
        deny: { execute: { './': ['git push'], 'secret/': ['*'] } },
      }),
    );

    expect(rules.allowed).toEqual(expect.arrayContaining(['bun run test', 'git', 'ask']));
    expect(rules.denied).toEqual(['git push']);
    expect(rules.closedDirs).toEqual(['/repo/secret']);
    expect(rules.cwd).toBe('/repo/.cache/runs/x');
  });
});

describe('commandViolation', () => {
  it('lets a command run when every command in it is allowed, wrapped by the shell or not', () => {
    expect(commandViolation("/bin/bash -lc 'bun run test && git status'", RULES)).toBeUndefined();
    expect(commandViolation('bash -c "git status | bun run test --watch"', RULES)).toBeUndefined();
    expect(commandViolation('bun run test', RULES)).toBeUndefined();
    expect(commandViolation("/bin/bash -lc 'cd .. ; git status'", RULES)).toBeUndefined();
    expect(commandViolation('cd', RULES)).toBeUndefined();
  });

  it('keeps an operator inside quotes in its command', () => {
    expect(commandViolation(`/bin/bash -lc 'bun run test "a && b"'`, RULES)).toBeUndefined();
    expect(commandViolation(`/bin/bash -lc "git status 'x;y'"`, RULES)).toBeUndefined();
  });

  it('stops at the first command outside the rules, naming it', () => {
    expect(commandViolation("/bin/bash -lc 'git status && rm -rf /'", RULES)).toBe(
      '✗ o agente rodou rm -rf /, fora de permissions.execute; a execução foi interrompida.',
    );
    expect(commandViolation('bun run testing', RULES)).toContain('bun run testing');
    expect(commandViolation('/bin/bash -lc unquoted', RULES)).toContain('rodou unquoted');
  });

  it('stops a denied command, even when every command is allowed', () => {
    const open = { ...RULES, allowed: ['*'] };
    expect(commandViolation('curl example.com', open)).toBeUndefined();
    expect(commandViolation("/bin/bash -lc 'git push origin main'", open)).toContain('rodou git push origin main');
  });

  it('stops a cd into a directory where every command is denied', () => {
    expect(commandViolation('cd /repo/secret/inner', RULES)).toContain('rodou cd /repo/secret/inner');
    expect(commandViolation("/bin/bash -lc 'cd ../../../secret && git status'", RULES)).toContain(
      'rodou cd ../../../secret',
    );
    expect(commandViolation("cd '/repo/docs'", RULES)).toBeUndefined();
  });

  it('lets a command that only reads run, whatever the rules, as Codex reads with the shell', () => {
    const none = { ...RULES, allowed: [] };

    expect(commandViolation("/bin/bash -lc 'cat /repo/.choliba/skills/x/SKILL.md'", none)).toBeUndefined();
    expect(commandViolation("/bin/bash -lc 'sed -n '\\''1,200p'\\'' README.md'", none)).toBeUndefined();
    expect(commandViolation('/bin/bash -lc "sed -n \'1,80p\' \\"a b.md\\""', none)).toBeUndefined();
    expect(commandViolation('sed -n 5p a.md', none)).toBeUndefined();
    expect(commandViolation('sed -n "10,$p" a.md', none)).toBeUndefined();
    expect(commandViolation("rg -n 'title' src | head -20", none)).toBeUndefined();
    expect(commandViolation('ls -la && pwd && wc -l a.md && nl a.md | tail -5', none)).toBeUndefined();
    expect(commandViolation("find src -name '*.ts' -type f", none)).toBeUndefined();
    expect(commandViolation('grep -rn x .', none)).toBeUndefined();
  });

  it('stops a reading command that would run another program or write, and a sed that is not a print', () => {
    const none = { ...RULES, allowed: [] };

    expect(commandViolation('find . -name x -exec rm {} ;', none)).toContain('rodou find . -name x -exec rm {}');
    expect(commandViolation('find . -delete', none)).toContain('rodou find . -delete');
    expect(commandViolation('rg --pre ./run x', none)).toContain('rodou rg --pre ./run x');
    expect(commandViolation('rg -z x', none)).toContain('rodou rg -z x');
    expect(commandViolation("sed -i 's/a/b/' a.md", none)).toContain("rodou sed -i 's/a/b/' a.md");
    expect(commandViolation("sed -n 'e rm -rf /' a.md", none)).toContain('rodou sed -n');
    expect(commandViolation('cat a | xargs rm', none)).toContain('rodou xargs rm');
    expect(commandViolation('cat a', { ...none, denied: ['cat'] })).toContain('rodou cat a');
  });

  it('stops a substitution, which the rules cannot check', () => {
    expect(commandViolation('git status $(rm -rf /)', RULES)).toBe(
      '✗ o agente rodou um comando com substituição, que as permissões não conseguem conferir: git status $(rm -rf /); a execução foi interrompida.',
    );
    expect(commandViolation('git status `id`', RULES)).toContain('substituição');
    expect(commandViolation('bun run test <(cat x)', RULES)).toContain('substituição');
  });
});
